// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBancorFormula} from "./interfaces/IBancorFormula.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "./SecurityModule.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IERC20Extended.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IMoxieBondingCurve.sol";

/**
 * @title Moxie Bonding curve
 * @author Moxie Team
 * @notice Bonding curve contract which enables subject onboarding, buy & sell of subject shares.
 */
contract MoxieBondingCurve is IMoxieBondingCurve, SecurityModule {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_FORMULA_ROLE =
        keccak256("UPDATE_FORMULA_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE =
        keccak256("UPDATE_BENEFICIARY_ROLE");

    error MoxieBondingCurve_InvalidToken();
    error MoxieBondingCurve_InvalidVault();
    error MoxieBondingCurve_InvalidBeneficiary();
    error MoxieBondingCurve_InvalidFeePercentage();
    error MoxieBondingCurve_InvalidFormula();
    error MoxieBondingCurve_InvalidTokenManager();
    error MoxieBondingCurve_InvalidOwner();
    error MoxieBondingCurve_InvalidSubjectFactory();
    error MoxieBondingCurve_OnlySubjectFactory();
    error MoxieBondingCurve_InvalidReserveFactory();
    error MoxieBondingCurve_InvalidReserveRation();
    error MoxieBondingCurve_TransferFailed();
    error MoxieBondingCurve_SubjectAlreadyInitialized();
    error MoxieBondingCurve_SubjectNotInitialized();
    error MoxieBondingCurve_InvalidSubjectSupply();
    error MoxieBondingCurve_InvalidSubject();
    error MoxieBondingCurve_InvalidDepositAmount();
    error MoxieBondingCurve_InvalidSubjectToken();
    error MoxieBondingCurve_SlippageExceedsLimit();
    error MoxieBondingCurve_InvalidSellAmount();

    event UpdateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct
    );

    event UpdateBeneficiary(address _beneficiary);

    event UpdateFormula(address _formula);

    event BondingCurveInitialized(
        address _subject,
        address _subjectToken,
        uint256 _initialSupply,
        uint256 _reserve,
        uint32 _reserveRatio
    );

    event SubjectSharePurchased(
        address _subject,
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        address _beneficiary
    );

    event SubjectShareSold(
        address _subject,
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        address _beneficiary
    );
    /// @dev Address of moxie token.
    IERC20Extended public token;
    /// @dev address of Bancors formula.
    IBancorFormula public formula;
    /// @dev Address of token manager contracts.
    ITokenManager public tokenManager;
    /// @dev Address of vault contract.
    IVault public vault;

    /// @dev Use to represeny fee percentage base 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    uint256 public constant PCT_BASE = 10 ** 18;
    /// @dev Use to represent reserve ratio, 1M is 1
    uint32 public constant PPM = 1000000;

    /// @dev Fee settings.
    uint256 public protocolBuyFeePct;
    uint256 public protocolSellFeePct;
    uint256 public subjectBuyFeePct;
    uint256 public subjectSellFeePct;

    /// @dev Address of protocol fee beneficiary.
    address public feeBeneficiary;

    /// @dev Address of subject factory.
    address public subjectFactory;

    /// @dev subject address vs reserve ratio
    mapping(address => uint32) public reserveRatio;

    /**
     * Initialize the contract.
     * @param _token Moxie token address.
     * @param _formula Bancors formula contract address.
     * @param _owner Owner of contract.
     * @param _tokenManager Address of token manager contract.
     * @param _vault Address of vault contract address.
     * @param _feeInput subject & protocol Feeinput struct.
     * @param _feeBeneficiary Protocol fee beneficiary.
     * @param _subjectFactory Subject Factory address.
     */
    function initialize(
        address _token,
        address _formula,
        address _owner,
        address _tokenManager,
        address _vault,
        FeeInput memory _feeInput,
        address _feeBeneficiary,
        address _subjectFactory
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();

        _validateInput(
            _token,
            _formula,
            _owner,
            _tokenManager,
            _vault,
            _feeBeneficiary,
            _subjectFactory
        );

        _validateFee(_feeInput);

        token = IERC20Extended(_token);
        formula = IBancorFormula(_formula);
        tokenManager = ITokenManager(_tokenManager);
        vault = IVault(_vault);
        protocolBuyFeePct = _feeInput.protocolBuyFeePct;
        protocolSellFeePct = _feeInput.protocolSellFeePct;
        subjectBuyFeePct = _feeInput.subjectBuyFeePct;
        subjectSellFeePct = _feeInput.subjectSellFeePct;
        feeBeneficiary = _feeBeneficiary;
        subjectFactory = _subjectFactory;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    /**
     * @dev Internal function to validate initialization input.
     * @param _token Address of moxie token.
     * @param _formula Address of formula contract address.
     * @param _owner Address of owner.
     * @param _tokenManager  Address of token manager.
     * @param _vault Address of vault.
     * @param _feeBeneficiary Address of fee beneficiary.
     * @param _subjectFactory Address of subject factory.
     */
    function _validateInput(
        address _token,
        address _formula,
        address _owner,
        address _tokenManager,
        address _vault,
        address _feeBeneficiary,
        address _subjectFactory
    ) internal pure {
        if (_isZeroAddress(_token)) revert MoxieBondingCurve_InvalidToken();
        if (_isZeroAddress(_formula)) revert MoxieBondingCurve_InvalidFormula();
        if (_isZeroAddress(_owner)) revert MoxieBondingCurve_InvalidOwner();
        if (_isZeroAddress(_tokenManager))
            revert MoxieBondingCurve_InvalidTokenManager();
        if (_isZeroAddress(_vault)) revert MoxieBondingCurve_InvalidVault();
        if (_isZeroAddress(_subjectFactory))
            revert MoxieBondingCurve_InvalidSubjectFactory();
        if (_isZeroAddress(_feeBeneficiary))
            revert MoxieBondingCurve_InvalidBeneficiary();
    }

    /**
     * Internal function to validate Fee params.
     * @param _feeInput Fee input struct.
     */
    function _validateFee(FeeInput memory _feeInput) internal pure {
        if (
            !_feeIsValid(_feeInput.protocolBuyFeePct) ||
            !_feeIsValid(_feeInput.protocolSellFeePct) ||
            !_feeIsValid(_feeInput.subjectBuyFeePct) ||
            !_feeIsValid(_feeInput.subjectSellFeePct)
        ) revert MoxieBondingCurve_InvalidFeePercentage();
    }

    /**
     * @dev Internal function to update fee beneficiary.
     * @param _beneficiary Address of fee beneficiary.
     */
    function _updateFeeBeneficiary(address _beneficiary) internal {
        feeBeneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    /**
     * @dev Internal function to update bancor formula.
     * @param _formula Address of formula contract address.
     */
    function _updateFormula(IBancorFormula _formula) internal {
        formula = _formula;

        emit UpdateFormula(address(_formula));
    }

    /**
     * @dev Internal function to validate fee.
     * @param _fee Fee Input in PCT_Base.
     */
    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return _fee < PCT_BASE;
    }

    /**
     * @dev Internal function to validate address.
     * @param _address  Address to validate.
     */
    function _isZeroAddress(address _address) internal pure returns (bool) {
        return _address == address(0);
    }

    /**
     * @dev Internal function to validate reserve ratio.
     * @param _reserveRatio Reserve ratio in PPM.
     */
    function _reserveRatioIsValid(
        uint32 _reserveRatio
    ) internal pure returns (bool) {
        return _reserveRatio <= PPM;
    }

    /**
     * @dev Internal function to update fee.
     * @param _protocolBuyFeePct Protocol fee percentage applied during buy share transaction.
     * @param _protocolSellFeePct Subject fee percentage applied during sell share transaction.
     * @param _subjectBuyFeePct Subject fee percentage applied during buy share transaction.
     * @param _subjectSellFeePct Subject fee percentage applied during sell share transaction.
     */
    function _updateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct
    ) internal {
        protocolBuyFeePct = _protocolBuyFeePct;
        protocolSellFeePct = _protocolSellFeePct;
        subjectBuyFeePct = _subjectBuyFeePct;
        subjectSellFeePct = _subjectSellFeePct;

        emit UpdateFees(
            protocolBuyFeePct,
            protocolSellFeePct,
            subjectBuyFeePct,
            subjectSellFeePct
        );
    }

    /**
     * @dev Internal function to buy  shares of subject.
     * @param _subjectToken Address of Subject Token.
     * @param _depositAmount Amount of deposit to buy shares.
     * @param _onBehalfOf Address of beneficiary where shares will be minted. This address can be zero address too.
     * @param _minReturnAmountAfterFee Minimum number of shares that must be recieved.
     * @param _subject Address of subject.
     * @param _subjectReserveRatio Subject Reserve ratio.
     */
    function _buyShares(
        IERC20Extended _subjectToken,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _subject,
        uint32 _subjectReserveRatio
    ) internal returns (uint256 shares_) {
        // moxie
        token.safeTransferFrom(msg.sender, address(this), _depositAmount);

        (uint256 protocolFee, uint256 subjectFee) = _calculateBuySideFee(
            _depositAmount
        );

        token.safeTransfer(_subject, subjectFee);
        token.safeTransfer(feeBeneficiary, protocolFee);
        uint256 vaultDeposit = _depositAmount - subjectFee - protocolFee;

        token.approve(address(vault), vaultDeposit);
        uint256 subjectReserve = vault.balanceOf(
            address(_subjectToken),
            address(token)
        );

        uint256 subjectSupply = _subjectToken.totalSupply();

        vault.deposit(address(_subjectToken), address(token), vaultDeposit);

        shares_ = formula.calculatePurchaseReturn(
            subjectSupply,
            subjectReserve,
            _subjectReserveRatio,
            vaultDeposit
        );

        if (shares_ < _minReturnAmountAfterFee)
            revert MoxieBondingCurve_SlippageExceedsLimit();

        ///@dev Don't mint if intent is to burn
         if (!_isZeroAddress(_onBehalfOf)) {
            tokenManager.mint(_subject, _onBehalfOf, shares_);
        }

        emit SubjectSharePurchased(
            _subject,
            address(token),
            _depositAmount,
            address(_subjectToken),
            shares_,
            _onBehalfOf
        );
    }

    /**
     * @dev Internal function to sell  shares of subject.
     * @param _subjectToken Address of Subject Token.
     * @param _sellAmount Amount of shares to sell.
     * @param _onBehalfOf Address of beneficiary where funds will be returned.
     * @param _minReturnAmountAfterFee Minimum amount of funds that should be returned.
     * @param _subject Address of subject.
     * @param _subjectReserveRatio Subject Reserve ratio.
     */
    function _sellShares(
        IERC20Extended _subjectToken,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _subject,
        uint32 _subjectReserveRatio
    ) internal returns (uint256 returnedAmount_) {
        uint256 subjectSupply = _subjectToken.totalSupply();
        uint256 subjectReserve = vault.balanceOf(
            address(_subjectToken),
            address(token)
        );

        uint256 returnAmountWithoutFee = formula.calculateSaleReturn(
            subjectSupply,
            subjectReserve,
            _subjectReserveRatio,
            _sellAmount
        );
        // burn subjectToken
        _subjectToken.safeTransferFrom(msg.sender, address(this), _sellAmount);
        _subjectToken.burn(_sellAmount);

        vault.transfer(
            address(_subjectToken),
            address(token),
            address(this),
            returnAmountWithoutFee
        );
        (uint256 protocolFee, uint256 subjectFee) = _calculateSellSideFee(
            returnAmountWithoutFee
        );

        token.safeTransfer(_subject, subjectFee);
        token.safeTransfer(feeBeneficiary, protocolFee);
        returnedAmount_ = returnAmountWithoutFee - subjectFee - protocolFee;

        if (returnedAmount_ < _minReturnAmountAfterFee)
            revert MoxieBondingCurve_SlippageExceedsLimit();

        token.transfer(_onBehalfOf, returnedAmount_);

        emit SubjectShareSold(
            _subject,
            address(_subjectToken),
            _sellAmount,
            address(token),
            returnedAmount_,
            _onBehalfOf
        );
    }

    /**
     * @dev Internal function to calculate buy side fee.
     * @param _depositAmount Deposit amount for buy.
     * @return protocolFee_ Buy side protocol fee in PCT_BASE.
     * @return subjectFee_  Buy side subject fee in PCT_BASE.
     */
    function _calculateBuySideFee(
        uint256 _depositAmount
    ) internal view returns (uint256 protocolFee_, uint256 subjectFee_) {
        protocolFee_ = (_depositAmount * protocolBuyFeePct) / PCT_BASE;
        subjectFee_ = (_depositAmount * subjectBuyFeePct) / PCT_BASE;
    }

    /**
     * @dev Internal function to calculate sell side fee.
     * @param _sellAmount Amount of subject shares to sell.
     * @return protocolFee_ Sell side protocol fee in PCT_BASE.
     * @return subjectFee_ Sell side subject fee in PCT_BASE.
     */
    function _calculateSellSideFee(
        uint256 _sellAmount
    ) internal view returns (uint256 protocolFee_, uint256 subjectFee_) {
        protocolFee_ = (_sellAmount * protocolSellFeePct) / PCT_BASE;
        subjectFee_ = (_sellAmount * subjectSellFeePct) / PCT_BASE;
    }

    /**
     * @notice Update fee only be called by role UPDATE_FEES_ROLE.
     * @param _feeInput Fee input struct.
     */
    function updateFees(
        FeeInput memory _feeInput
    ) external onlyRole(UPDATE_FEES_ROLE) {
        _validateFee(_feeInput);

        _updateFees(
            _feeInput.protocolBuyFeePct,
            _feeInput.protocolSellFeePct,
            _feeInput.subjectBuyFeePct,
            _feeInput.subjectSellFeePct
        );
    }

    /**
     * @notice Update formula to `_formula`. It can be done by UPDATE_FORMULA_ROLE.
     * @param _formula The address of the new BancorFormula [computation] contract
     */
    function updateFormula(
        address _formula
    ) external onlyRole(UPDATE_FORMULA_ROLE) {
        if (_isZeroAddress(_formula)) revert MoxieBondingCurve_InvalidFormula();

        _updateFormula(IBancorFormula(_formula));
    }

    /**
     * @notice Update beneficiary to `_beneficiary. It can be done by UPDATE_BENEFICIARY_ROLE.
     * @param _feeBeneficiary The address of the new beneficiary [to whom fees are to be sent]
     */
    function updateFeeBeneficiary(
        address _feeBeneficiary
    ) external onlyRole(UPDATE_BENEFICIARY_ROLE) {
        if (_isZeroAddress(_feeBeneficiary))
            revert MoxieBondingCurve_InvalidBeneficiary();

        _updateFeeBeneficiary(_feeBeneficiary);
    }

    /**
     * @notice Initialize Bonding curve for subject, it's called by subject factory.
     * @param _subject Address of subject.
     * @param _initialSupply Initial supply of subjects tokens at the time of bonding curve initialization.
     * @param _reserveRatio reserve ratio of subject for bonding curve.
     * @param _reserveAmount Initial reseve amount.
     */
    function initializeSubjectBondingCurve(
        address _subject,
        uint32 _reserveRatio,
        uint256 _initialSupply,
        uint256 _reserveAmount
    ) external whenNotPaused returns (bool) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();

        if (msg.sender != subjectFactory)
            revert MoxieBondingCurve_OnlySubjectFactory();

        if (!_reserveRatioIsValid(_reserveRatio))
            revert MoxieBondingCurve_InvalidReserveRation();

        if (reserveRatio[_subject] != 0)
            revert MoxieBondingCurve_SubjectAlreadyInitialized();

        address subjectToken = tokenManager.tokens(_subject);

        if (_isZeroAddress(subjectToken))
            revert MoxieBondingCurve_InvalidSubjectToken();

        uint256 supply = IERC20Extended(subjectToken)
            .totalSupply();

        if (_initialSupply != supply)
            revert MoxieBondingCurve_InvalidSubjectSupply();

        reserveRatio[_subject] = _reserveRatio;
        token.safeTransferFrom(msg.sender, address(this), _reserveAmount);
        token.approve(address(vault), _reserveAmount);
        vault.deposit(subjectToken, address(token), _reserveAmount);

        emit BondingCurveInitialized(
            _subject,
            subjectToken,
            _initialSupply,
            _reserveAmount,
            _reserveRatio
        );

        return true;
    }

    //todo add moxie pass check
    //todo decide if onBehalfOf can be address(0)
    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _onBehalfOf  Beneficiary where shares will be minted.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buyShares(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused returns (uint256 shares_) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_depositAmount == 0)
            revert MoxieBondingCurve_InvalidDepositAmount();

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0)
            revert MoxieBondingCurve_SubjectNotInitialized();

        IERC20Extended subjectToken = IERC20Extended(
            tokenManager.tokens(_subject)
        );

        if (_isZeroAddress(address(subjectToken)))
            revert MoxieBondingCurve_InvalidSubjectToken();

        shares_ = _buyShares(
            subjectToken,
            _depositAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee,
            _subject,
            subjectReserveRatio
        );
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _onBehalfOf Address of buy token beneficiary.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellShares(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused returns (uint256 returnAmount_) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_sellAmount == 0) revert MoxieBondingCurve_InvalidSellAmount();

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0)
            revert MoxieBondingCurve_SubjectNotInitialized();

        IERC20Extended subjectToken = IERC20Extended(
            tokenManager.tokens(_subject)
        );

        if (_isZeroAddress(address(subjectToken)))
            revert MoxieBondingCurve_InvalidSubjectToken();

        returnAmount_ = _sellShares(
            subjectToken,
            _sellAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee,
            _subject,
            subjectReserveRatio
        );
    }
}
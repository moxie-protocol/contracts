// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBancorFormula} from "./interfaces/IBancorFormula.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IMoxieBondingCurve} from "./interfaces/IMoxieBondingCurve.sol";

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
    error MoxieBondingCurve_InvalidReserveRation();
    error MoxieBondingCurve_SubjectAlreadyInitialized();
    error MoxieBondingCurve_SubjectNotInitialized();
    error MoxieBondingCurve_InvalidSubjectSupply();
    error MoxieBondingCurve_InvalidSubject();
    error MoxieBondingCurve_InvalidDepositAmount();
    error MoxieBondingCurve_InvalidSubjectToken();
    error MoxieBondingCurve_SlippageExceedsLimit();
    error MoxieBondingCurve_InvalidSellAmount();
    error MoxieBondingCurve_InvalidAmount();

    event UpdateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct
    );

    event UpdateBeneficiary(address _beneficiary);

    event UpdateFormula(address _formula);

    event BondingCurveInitialized(
        address indexed _subject,
        address indexed _subjectToken,
        uint256 _initialSupply,
        uint256 _reserve,
        uint32 _reserveRatio
    );

    event SubjectSharePurchased(
        address indexed _subject,
        address indexed _sellToken,
        uint256 _sellAmount,
        address _spender,
        address _buyToken,
        uint256 _buyAmount,
        address indexed _beneficiary
    );

    event SubjectShareSold(
        address indexed _subject,
        address indexed _sellToken,
        uint256 _sellAmount,
        address _spender,
        address _buyToken,
        uint256 _buyAmount,
        address indexed _beneficiary
    );
    /// @dev Address of moxie token.
    IERC20Extended public token;
    /// @dev address of Bancors formula.
    IBancorFormula public formula;
    /// @dev Address of token manager contracts.
    ITokenManager public tokenManager;
    /// @dev Address of vault contract.
    IVault public vault;

    /// @dev Use to represent fee percentage base 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
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
    mapping(address subject => uint32 _reserveRatio) public reserveRatio;

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
            !_feeIsValid(
                _feeInput.protocolBuyFeePct + _feeInput.subjectBuyFeePct
            ) ||
            !_feeIsValid(
                _feeInput.protocolSellFeePct + _feeInput.subjectSellFeePct
            )
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
     * @param _minReturnAmountAfterFee Minimum number of shares that must be received.
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
        {
            //to solve stack too deep issue.
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

            vault.deposit(address(_subjectToken), address(token), vaultDeposit);

            shares_ = formula.calculatePurchaseReturn(
                _subjectToken.totalSupply(),
                subjectReserve,
                _subjectReserveRatio,
                vaultDeposit
            );
        }

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
            msg.sender,
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
        uint256 subjectReserve = vault.balanceOf(
            address(_subjectToken),
            address(token)
        );

        uint256 returnAmountWithoutFee = formula.calculateSaleReturn(
            _subjectToken.totalSupply(),
            subjectReserve,
            _subjectReserveRatio,
            _sellAmount
        );

        (uint256 protocolFee, uint256 subjectFee) = _calculateSellSideFee(
            returnAmountWithoutFee
        );

        returnedAmount_ = returnAmountWithoutFee - subjectFee - protocolFee;
        if (returnedAmount_ < _minReturnAmountAfterFee)
            revert MoxieBondingCurve_SlippageExceedsLimit();
        emit SubjectShareSold(
            _subject,
            address(_subjectToken),
            _sellAmount,
            msg.sender,
            address(token),
            returnedAmount_,
            _onBehalfOf
        );

        // burn subjectToken
        _subjectToken.burnFrom(msg.sender, _sellAmount);

        vault.transfer(
            address(_subjectToken),
            address(token),
            address(this),
            returnAmountWithoutFee
        );

        token.safeTransfer(_subject, subjectFee);
        token.safeTransfer(feeBeneficiary, protocolFee);
        token.safeTransfer(_onBehalfOf, returnedAmount_);
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

    function _sellSharesInternal(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) internal whenNotPaused returns (uint256 returnAmount_) {
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

    function _buySharesInternal(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) internal returns (uint256 shares_) {
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
     * @notice Validates Subject Input
     * @param _subject  Address of subject
     * @param _subjectTokenAmount Amount of buy/sell estimates.
     * @return subjectReserveRatio_ Reserve ratio of subject.
     * @return subjectReserve_ Total reserve of Subject.
     * @return subjectSupply_ Total supply of subject token.
     */
    function _validateSubjectInput(
        address _subject,
        uint256 _subjectTokenAmount
    )
        internal
        view
        returns (
            uint32 subjectReserveRatio_,
            uint256 subjectReserve_,
            uint256 subjectSupply_
        )
    {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_subjectTokenAmount == 0) revert MoxieBondingCurve_InvalidAmount();

        subjectReserveRatio_ = reserveRatio[_subject];

        if (subjectReserveRatio_ == 0)
            revert MoxieBondingCurve_SubjectNotInitialized();

        IERC20Extended subjectToken = IERC20Extended(
            tokenManager.tokens(_subject)
        );

        subjectReserve_ = vault.balanceOf(
            address(subjectToken),
            address(token)
        );

        subjectSupply_ = subjectToken.totalSupply();
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
     * @param _reserveAmount Initial reserve amount.
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
        reserveRatio[_subject] = _reserveRatio;

        address subjectToken = tokenManager.tokens(_subject);

        if (_isZeroAddress(subjectToken))
            revert MoxieBondingCurve_InvalidSubjectToken();

        emit BondingCurveInitialized(
            _subject,
            subjectToken,
            _initialSupply,
            _reserveAmount,
            _reserveRatio
        );
        uint256 supply = IERC20Extended(subjectToken).totalSupply();
        if (_initialSupply != supply)
            revert MoxieBondingCurve_InvalidSubjectSupply();

        token.safeTransferFrom(msg.sender, address(this), _reserveAmount);
        token.approve(address(vault), _reserveAmount);
        vault.deposit(subjectToken, address(token), _reserveAmount);

        return true;
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _onBehalfOf  Beneficiary where shares will be minted.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buySharesFor(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused returns (uint256 shares_) {
        shares_ = _buySharesInternal(
            _subject,
            _depositAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee
        );
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buyShares(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused returns (uint256 shares_) {
        shares_ = _buySharesInternal(
            _subject,
            _depositAmount,
            msg.sender,
            _minReturnAmountAfterFee
        );
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _onBehalfOf Address of buy token beneficiary.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellSharesFor(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused returns (uint256 returnAmount_) {
        returnAmount_ = _sellSharesInternal(
            _subject,
            _sellAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee
        );
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellShares(
        address _subject,
        uint256 _sellAmount,
        uint256 _minReturnAmountAfterFee
    ) external whenNotPaused returns (uint256 returnAmount_) {
        returnAmount_ = _sellSharesInternal(
            _subject,
            _sellAmount,
            msg.sender,
            _minReturnAmountAfterFee
        );
    }

    /**
     * @notice Estimates amount of Moxie token required to buy given subject token amount
     * @param _subject  Address of subject.
     * @param _subjectTokenAmount  Amount of subject tokens.
     */
    function calculateTokensForBuy(
        address _subject,
        uint256 _subjectTokenAmount
    )
        external
        view
        returns (
            uint256 moxieAmount_,
            uint256 protocolFee_,
            uint256 subjectFee_
        )
    {
        (
            uint32 subjectReserveRatio_,
            uint256 subjectReserve_,
            uint256 subjectSupply_
        ) = _validateSubjectInput(_subject, _subjectTokenAmount);

        uint256 estimatedAmount = formula.calculateFundCost(
            subjectSupply_,
            subjectReserve_,
            subjectReserveRatio_,
            _subjectTokenAmount
        );

        uint256 totalFeePCT = protocolBuyFeePct + subjectBuyFeePct;
        moxieAmount_ = (estimatedAmount * PCT_BASE) / (PCT_BASE - totalFeePCT);

        (protocolFee_, subjectFee_) = _calculateBuySideFee(moxieAmount_);
    }

    /**
     * @notice Estimates amount of Moxie tokes will be returned after selling given subject tokens.
     * @param _subject  Address of subject.
     * @param _subjectTokenAmount  Amount of subject tokens.
     */
    function calculateTokensForSell(
        address _subject,
        uint256 _subjectTokenAmount
    )
        external
        view
        returns (
            uint256 moxieAmount_,
            uint256 protocolFee_,
            uint256 subjectFee_
        )
    {
        (
            uint32 subjectReserveRatio_,
            uint256 subjectReserve_,
            uint256 subjectSupply_
        ) = _validateSubjectInput(_subject, _subjectTokenAmount);

        uint256 estimatedAmount = formula.calculateSaleReturn(
            subjectSupply_,
            subjectReserve_,
            subjectReserveRatio_,
            _subjectTokenAmount
        );

        (protocolFee_, subjectFee_) = _calculateSellSideFee(estimatedAmount);

        moxieAmount_ = estimatedAmount - protocolFee_ - subjectFee_;
    }
}

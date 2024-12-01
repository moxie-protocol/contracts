// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBancorFormula} from "./interfaces/IBancorFormula.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IMoxieBondingCurveV2} from "./interfaces/IMoxieBondingCurveV2.sol";
import {IProtocolRewards} from "./rewards/IProtocolRewards.sol";

/**
 * @title Moxie Bonding curve
 * @author Moxie Team
 * @notice Bonding curve contract which enables subject onboarding, buy & sell of subject shares.
 */
contract MoxieBondingCurveV2 is IMoxieBondingCurveV2, SecurityModule {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_FORMULA_ROLE = keccak256("UPDATE_FORMULA_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_PROTOCOL_REWARD_ROLE = keccak256("UPDATE_PROTOCOL_REWARD_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO = keccak256("UPDATE_RESERVE_RATIO");

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
    error MoxieBondingCurve_InvalidProtocolRewardAddress();

    event UpdateFees(
        uint256 _protocolBuyFeePct, uint256 _protocolSellFeePct, uint256 _subjectBuyFeePct, uint256 _subjectSellFeePct
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

    event UpdateReferralFees(
        uint256 _platformReferrerBuyFeePct,
        uint256 _platformReferrerSellFeePct,
        uint256 _orderReferrerBuyFeePct,
        uint256 _orderReferrerSellFeePct
    );

    event SubjectReserveRatioUpdated(
        address _subject,
        uint32 _oldReserveRatio,
        uint32 _newReserveRatio
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

    IProtocolRewards public protocolRewards;

    mapping(address subject => address _platformReferrer) public platformReferrer;

    /// @dev these fee is calculated from protocol fees.
    uint256 public platformReferrerBuyFeePct;
    uint256 public platformReferrerSellFeePct;
    uint256 public orderReferrerBuyFeePct;
    uint256 public orderReferrerSellFeePct;

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

        _validateInput(_token, _formula, _owner, _tokenManager, _vault, _feeBeneficiary, _subjectFactory);

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
        if (_isZeroAddress(_tokenManager)) {
            revert MoxieBondingCurve_InvalidTokenManager();
        }
        if (_isZeroAddress(_vault)) revert MoxieBondingCurve_InvalidVault();
        if (_isZeroAddress(_subjectFactory)) {
            revert MoxieBondingCurve_InvalidSubjectFactory();
        }
        if (_isZeroAddress(_feeBeneficiary)) {
            revert MoxieBondingCurve_InvalidBeneficiary();
        }
    }

    /**
     * Internal function to validate Fee params.
     * @param _feeInput Fee input struct.
     */
    function _validateFee(FeeInput memory _feeInput) internal pure {
        if (
            !_feeIsValid(_feeInput.protocolBuyFeePct + _feeInput.subjectBuyFeePct)
                || !_feeIsValid(_feeInput.protocolSellFeePct + _feeInput.subjectSellFeePct)
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
    function _reserveRatioIsValid(uint32 _reserveRatio) internal pure returns (bool) {
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

        emit UpdateFees(protocolBuyFeePct, protocolSellFeePct, subjectBuyFeePct, subjectSellFeePct);
    }

    function _calculateFee(uint256 _amount, uint256 _fee) private pure returns (uint256) {
        return (_amount * _fee) / PCT_BASE;
    }

    function _processFeeForBuySell(
        address _subject,
        uint256 _subjectFee,
        uint256 _protocolFee,
        address _orderReferrer,
        bool _isBuy
    ) private {
        address platformReferrerAddress = platformReferrer[_subject];
        if (platformReferrerAddress == address(0)) {
            platformReferrerAddress = feeBeneficiary;
        }

        if (_orderReferrer == address(0)) {
            _orderReferrer = feeBeneficiary;
        }

        address[] memory recipients = new address[](4);
        uint256[] memory amounts = new uint256[](4);
        bytes4[] memory reasons = new bytes4[](4);

        uint256 totalAmount = _subjectFee + _protocolFee;

        token.approve(address(protocolRewards), totalAmount);

        recipients[0] = _subject;
        amounts[0] = _subjectFee;
        reasons[0] = bytes4(keccak256("TRANSACTION_FEE"));

        uint256 orderReferrerFee =
            _calculateFee(_protocolFee, _isBuy ? orderReferrerBuyFeePct : orderReferrerSellFeePct);
        uint256 platformReferrerFee =
            _calculateFee(_protocolFee, _isBuy ? platformReferrerBuyFeePct : platformReferrerSellFeePct);

        recipients[1] = _orderReferrer;
        amounts[1] = orderReferrerFee;
        reasons[1] = bytes4(keccak256("ORDER_REFERRER_FEE"));

        recipients[2] = platformReferrerAddress;
        amounts[2] = platformReferrerFee;
        reasons[2] = bytes4(keccak256("PLATFORM_REFERRER_FEE"));

        uint256 actualProtocolFee = _protocolFee - orderReferrerFee - platformReferrerFee;

        recipients[3] = feeBeneficiary;
        amounts[3] = actualProtocolFee;
        reasons[3] = bytes4(keccak256("PROTOCOL_FEE"));

        protocolRewards.depositBatch(recipients, amounts, reasons, "TRANSACTION_FEE");
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
        uint32 _subjectReserveRatio,
        address _orderReferrer
    ) internal returns (uint256 shares_) {
        // moxie
        token.safeTransferFrom(msg.sender, address(this), _depositAmount);
        {
            //to solve stack too deep issue.
            (uint256 protocolFee, uint256 subjectFee) = _calculateBuySideFee(_depositAmount);

            _processFeeForBuySell(_subject, subjectFee, protocolFee, _orderReferrer, true);

            uint256 vaultDeposit = _depositAmount - subjectFee - protocolFee;

            token.approve(address(vault), vaultDeposit);
            uint256 subjectReserve = vault.balanceOf(address(_subjectToken), address(token));

            vault.deposit(address(_subjectToken), address(token), vaultDeposit);

            shares_ = formula.calculatePurchaseReturn(
                _subjectToken.totalSupply(), subjectReserve, _subjectReserveRatio, vaultDeposit
            );
        }

        if (shares_ < _minReturnAmountAfterFee) {
            revert MoxieBondingCurve_SlippageExceedsLimit();
        }

        ///@dev Don't mint if intent is to burn
        if (!_isZeroAddress(_onBehalfOf)) {
            tokenManager.mint(_subject, _onBehalfOf, shares_);
        }

        emit SubjectSharePurchased(
            _subject, address(token), _depositAmount, msg.sender, address(_subjectToken), shares_, _onBehalfOf
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
        uint32 _subjectReserveRatio,
        address _orderReferrer
    ) internal returns (uint256 returnedAmount_) {
        uint256 subjectReserve = vault.balanceOf(address(_subjectToken), address(token));

        uint256 returnAmountWithoutFee =
            formula.calculateSaleReturn(_subjectToken.totalSupply(), subjectReserve, _subjectReserveRatio, _sellAmount);

        (uint256 protocolFee, uint256 subjectFee) = _calculateSellSideFee(returnAmountWithoutFee);

        returnedAmount_ = returnAmountWithoutFee - subjectFee - protocolFee;
        if (returnedAmount_ < _minReturnAmountAfterFee) {
            revert MoxieBondingCurve_SlippageExceedsLimit();
        }
        emit SubjectShareSold(
            _subject, address(_subjectToken), _sellAmount, msg.sender, address(token), returnedAmount_, _onBehalfOf
        );

        // burn subjectToken
        _subjectToken.burnFrom(msg.sender, _sellAmount);

        vault.transfer(address(_subjectToken), address(token), address(this), returnAmountWithoutFee);

        _processFeeForBuySell(_subject, subjectFee, protocolFee, _orderReferrer, false);
        token.safeTransfer(_onBehalfOf, returnedAmount_);
    }

    /**
     * @dev Internal function to calculate buy side fee.
     * @param _depositAmount Deposit amount for buy.
     * @return protocolFee_ Buy side protocol fee in PCT_BASE.
     * @return subjectFee_  Buy side subject fee in PCT_BASE.
     */
    function _calculateBuySideFee(uint256 _depositAmount)
        internal
        view
        returns (uint256 protocolFee_, uint256 subjectFee_)
    {
        protocolFee_ = (_depositAmount * protocolBuyFeePct) / PCT_BASE;
        subjectFee_ = (_depositAmount * subjectBuyFeePct) / PCT_BASE;
    }

    /**
     * @dev Internal function to calculate sell side fee.
     * @param _sellAmount Amount of subject shares to sell.
     * @return protocolFee_ Sell side protocol fee in PCT_BASE.
     * @return subjectFee_ Sell side subject fee in PCT_BASE.
     */
    function _calculateSellSideFee(uint256 _sellAmount)
        internal
        view
        returns (uint256 protocolFee_, uint256 subjectFee_)
    {
        protocolFee_ = (_sellAmount * protocolSellFeePct) / PCT_BASE;
        subjectFee_ = (_sellAmount * subjectSellFeePct) / PCT_BASE;
    }

    function _sellSharesInternal(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) internal whenNotPaused returns (uint256 returnAmount_) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_sellAmount == 0) revert MoxieBondingCurve_InvalidSellAmount();

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));

        if (_isZeroAddress(address(subjectToken))) {
            revert MoxieBondingCurve_InvalidSubjectToken();
        }

        returnAmount_ = _sellShares(
            subjectToken,
            _sellAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee,
            _subject,
            subjectReserveRatio,
            _orderReferrer
        );
    }

    function _buySharesInternal(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) internal returns (uint256 shares_) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_depositAmount == 0) {
            revert MoxieBondingCurve_InvalidDepositAmount();
        }

        uint32 subjectReserveRatio = reserveRatio[_subject];

        if (subjectReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));

        if (_isZeroAddress(address(subjectToken))) {
            revert MoxieBondingCurve_InvalidSubjectToken();
        }

        shares_ = _buyShares(
            subjectToken,
            _depositAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee,
            _subject,
            subjectReserveRatio,
            _orderReferrer
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
    function _validateSubjectInput(address _subject, uint256 _subjectTokenAmount)
        internal
        view
        returns (uint32 subjectReserveRatio_, uint256 subjectReserve_, uint256 subjectSupply_)
    {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();
        if (_subjectTokenAmount == 0) revert MoxieBondingCurve_InvalidAmount();

        subjectReserveRatio_ = reserveRatio[_subject];

        if (subjectReserveRatio_ == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));

        subjectReserve_ = vault.balanceOf(address(subjectToken), address(token));

        subjectSupply_ = subjectToken.totalSupply();
    }

    function updateProtocolRewardAddress(address _protocolRewardsAddress)
        external
        onlyRole(UPDATE_PROTOCOL_REWARD_ROLE)
    {
        if (_isZeroAddress(_protocolRewardsAddress)) {
            revert MoxieBondingCurve_InvalidProtocolRewardAddress();
        }
        protocolRewards = IProtocolRewards(_protocolRewardsAddress);
    }

    /**
     * @notice Update fee only be called by role UPDATE_FEES_ROLE.
     * @param _feeInput Fee input struct.
     */
    function updateFees(FeeInput memory _feeInput) external onlyRole(UPDATE_FEES_ROLE) {
        _validateFee(_feeInput);

        _updateFees(
            _feeInput.protocolBuyFeePct,
            _feeInput.protocolSellFeePct,
            _feeInput.subjectBuyFeePct,
            _feeInput.subjectSellFeePct
        );
    }

    /**
     * @notice Update referral fees.
     * @param _platformReferrerBuyFeePct Platform referrer buy fee percentage.
     * @param _platformReferrerSellFeePct Platform referrer sell fee percentage.
     * @param _orderReferrerBuyFeePct Order referrer buy fee percentage.
     * @param _orderReferrerSellFeePct Order referrer sell fee percentage.
     */

    function updateReferralFee(
        uint256 _platformReferrerBuyFeePct,
        uint256 _platformReferrerSellFeePct,
        uint256 _orderReferrerBuyFeePct,
        uint256 _orderReferrerSellFeePct
    ) external onlyRole(UPDATE_FEES_ROLE) {
        if (
            !_feeIsValid(_platformReferrerBuyFeePct + _orderReferrerBuyFeePct)
                || !_feeIsValid(_platformReferrerSellFeePct + _orderReferrerSellFeePct)
        ) revert MoxieBondingCurve_InvalidFeePercentage();

        platformReferrerBuyFeePct = _platformReferrerBuyFeePct;
        platformReferrerSellFeePct = _platformReferrerSellFeePct;
        orderReferrerBuyFeePct = _orderReferrerBuyFeePct;
        orderReferrerSellFeePct = _orderReferrerSellFeePct;

        emit UpdateReferralFees(
            platformReferrerBuyFeePct, platformReferrerSellFeePct, orderReferrerBuyFeePct, orderReferrerSellFeePct
        );
    }

    /**
     * @dev Allow updation of reserve ratio by determined by DAO for specific subject.
     * @param _subject Address of subject.
     * @param _newReserveRatio new Reserve ratio. 
     */
    function updateReserveRatio(
        address _subject,
        uint32 _newReserveRatio
    ) external onlyRole(UPDATE_RESERVE_RATIO) {

        uint32 currentReserveRatio = reserveRatio[_subject];

        if (currentReserveRatio == 0) {
            revert MoxieBondingCurve_SubjectNotInitialized();
        }

        if ( _newReserveRatio == 0 || !_reserveRatioIsValid(_newReserveRatio)) {
            revert MoxieBondingCurve_InvalidReserveRation();
        }

        reserveRatio[_subject] = _newReserveRatio;

        emit SubjectReserveRatioUpdated(
            _subject,
            currentReserveRatio,
            _newReserveRatio
        );
    }

    /**
     * @notice Update formula to `_formula`. It can be done by UPDATE_FORMULA_ROLE.
     * @param _formula The address of the new BancorFormula [computation] contract
     */
    function updateFormula(address _formula) external onlyRole(UPDATE_FORMULA_ROLE) {
        if (_isZeroAddress(_formula)) revert MoxieBondingCurve_InvalidFormula();

        _updateFormula(IBancorFormula(_formula));
    }

    /**
     * @notice Update beneficiary to `_beneficiary. It can be done by UPDATE_BENEFICIARY_ROLE.
     * @param _feeBeneficiary The address of the new beneficiary [to whom fees are to be sent]
     */
    function updateFeeBeneficiary(address _feeBeneficiary) external onlyRole(UPDATE_BENEFICIARY_ROLE) {
        if (_isZeroAddress(_feeBeneficiary)) {
            revert MoxieBondingCurve_InvalidBeneficiary();
        }

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
        uint256 _reserveAmount,
        address _platformReferrer
    ) external whenNotPaused returns (bool) {
        if (_isZeroAddress(_subject)) revert MoxieBondingCurve_InvalidSubject();

        if (msg.sender != subjectFactory) {
            revert MoxieBondingCurve_OnlySubjectFactory();
        }

        if (!_reserveRatioIsValid(_reserveRatio)) {
            revert MoxieBondingCurve_InvalidReserveRation();
        }

        if (reserveRatio[_subject] != 0) {
            revert MoxieBondingCurve_SubjectAlreadyInitialized();
        }
        reserveRatio[_subject] = _reserveRatio;
        platformReferrer[_subject] = _platformReferrer;

        address subjectToken = tokenManager.tokens(_subject);

        if (_isZeroAddress(subjectToken)) {
            revert MoxieBondingCurve_InvalidSubjectToken();
        }

        emit BondingCurveInitialized(_subject, subjectToken, _initialSupply, _reserveAmount, _reserveRatio);
        uint256 supply = IERC20Extended(subjectToken).totalSupply();
        if (_initialSupply != supply) {
            revert MoxieBondingCurve_InvalidSubjectSupply();
        }

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
        shares_ = _buySharesInternal(_subject, _depositAmount, _onBehalfOf, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buyShares(address _subject, uint256 _depositAmount, uint256 _minReturnAmountAfterFee)
        external
        whenNotPaused
        returns (uint256 shares_)
    {
        shares_ = _buySharesInternal(_subject, _depositAmount, msg.sender, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _onBehalfOf Address of buy token beneficiary.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellSharesFor(address _subject, uint256 _sellAmount, address _onBehalfOf, uint256 _minReturnAmountAfterFee)
        external
        whenNotPaused
        returns (uint256 returnAmount_)
    {
        returnAmount_ = _sellSharesInternal(_subject, _sellAmount, _onBehalfOf, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellShares(address _subject, uint256 _sellAmount, uint256 _minReturnAmountAfterFee)
        external
        whenNotPaused
        returns (uint256 returnAmount_)
    {
        returnAmount_ = _sellSharesInternal(_subject, _sellAmount, msg.sender, _minReturnAmountAfterFee, address(0));
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _onBehalfOf  Beneficiary where shares will be minted.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buySharesForV2(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused returns (uint256 shares_) {
        shares_ = _buySharesInternal(_subject, _depositAmount, _onBehalfOf, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @dev Buy shares of subject.
     * @param _subject Address of subject.
     * @param _depositAmount Deposit amount to buy shares.
     * @param _minReturnAmountAfterFee Minimum shares that must be returned.
     */
    function buySharesV2(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused returns (uint256 shares_) {
        shares_ = _buySharesInternal(_subject, _depositAmount, msg.sender, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _onBehalfOf Address of buy token beneficiary.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellSharesForV2(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused returns (uint256 returnAmount_) {
        returnAmount_ =
            _sellSharesInternal(_subject, _sellAmount, _onBehalfOf, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @dev Sell shares of subject.
     * @param _subject Address of subject.
     * @param _sellAmount Amount of subject shares to sell.
     * @param _minReturnAmountAfterFee Minimum buy token that must be returned.
     */
    function sellSharesV2(
        address _subject,
        uint256 _sellAmount,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external whenNotPaused returns (uint256 returnAmount_) {
        returnAmount_ = _sellSharesInternal(_subject, _sellAmount, msg.sender, _minReturnAmountAfterFee, _orderReferrer);
    }

    /**
     * @notice Estimates amount of Moxie token required to buy given subject token amount
     * @param _subject  Address of subject.
     * @param _subjectTokenAmount  Amount of subject tokens.
     */
    function calculateTokensForBuy(address _subject, uint256 _subjectTokenAmount)
        external
        view
        returns (uint256 moxieAmount_, uint256 protocolFee_, uint256 subjectFee_)
    {
        (uint32 subjectReserveRatio_, uint256 subjectReserve_, uint256 subjectSupply_) =
            _validateSubjectInput(_subject, _subjectTokenAmount);

        uint256 estimatedAmount =
            formula.calculateFundCost(subjectSupply_, subjectReserve_, subjectReserveRatio_, _subjectTokenAmount);

        uint256 totalFeePCT = protocolBuyFeePct + subjectBuyFeePct;
        moxieAmount_ = (estimatedAmount * PCT_BASE) / (PCT_BASE - totalFeePCT);

        (protocolFee_, subjectFee_) = _calculateBuySideFee(moxieAmount_);
    }

    /**
     * @notice Estimates amount of Moxie tokes will be returned after selling given subject tokens.
     * @param _subject  Address of subject.
     * @param _subjectTokenAmount  Amount of subject tokens.
     */
    function calculateTokensForSell(address _subject, uint256 _subjectTokenAmount)
        external
        view
        returns (uint256 moxieAmount_, uint256 protocolFee_, uint256 subjectFee_)
    {
        (uint32 subjectReserveRatio_, uint256 subjectReserve_, uint256 subjectSupply_) =
            _validateSubjectInput(_subject, _subjectTokenAmount);

        uint256 estimatedAmount =
            formula.calculateSaleReturn(subjectSupply_, subjectReserve_, subjectReserveRatio_, _subjectTokenAmount);

        (protocolFee_, subjectFee_) = _calculateSellSideFee(estimatedAmount);

        moxieAmount_ = estimatedAmount - protocolFee_ - subjectFee_;
    }
}

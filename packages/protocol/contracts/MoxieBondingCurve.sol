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

contract MoxieBondingCurve is SecurityModule {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_FORMULA_ROLE =
        keccak256("UPDATE_FORMULA_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE =
        keccak256("UPDATE_BENEFICIARY_ROLE");

    string private ERROR_INVALID_BENEFICIARY = "INVALID_BENEFICIARY";
    string private ERROR_INVALID_PERCENTAGE = "INVALID_PERCENTAGE";
    string private ERROR_INVALID_FORMULA = "INVALID_FORMULA";
    string private ERROR_INVALID_TOKEN_MANAGER = "INVALID_TOKEN_MANAGER";
    string private ERROR_INVALID_OWNER = "INVALID_OWNER";
    string private ERROR_INVAID_SUBJECT_FACTORY = "INVAID_SUBJECT_FACTORY";
    string private ERROR_ONLY_SUBJECT_FACTORY = "ONLY_SUBJECT_FACTORY";
    string private ERROR_INVALID_RESERVE_RATIO = "INVALID_RESERVE_RATIO";
    string private ERROR_TRANSFER_FAILED = "TRANSFER_FAILED";
    string private ERROR_SUBJECT_ALREADY_INITIALIZED =
        "SUBJECT_ALREADY_INITIALIZED";

    string private ERROR_SUBJECT_NOT_INITIALIZED = "SUBJECT_NOT_INITIALIZED";

    string private ERROR_INVALID_SUBJECT_SUPPLY = "INVALID_SUBJECT_SUPPLY";
    string private ERROR_INVALID_SUBJECT = "INVALID_SUBJECT";
    string private ERROR_INVALID_DEPOSIT_AMOUNT = "INVALID_DEPOSIT_AMOUNT";
    string private ERROR_INVALID_SUBJECT_TOKEN = "INVALID_DEPOSIT_AMOUNT";
    string private ERROR_SLIPPAGE_EXCEEDS_LIMIT = "SLIPPAGE_EXCEEDS_LIMIT";

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
        uint256 _initialSupply,
        uint256 _reserve,
        uint32 _reserveRation
    );

    event SubjectSharePurchased(
        address _subject,
        address _depositToken,
        uint256 _depositAmount,
        address _subjectToken,
        uint256 _subjectShare,
        address _beneficiary
    );

    event SubjectShareSold(
        address _subject,
        address _sellToken,
        uint256 _sellAmount,
        address _token,
        uint256 _amount,
        address _beneficiary
    );

    IERC20Extended public token;
    IBancorFormula public formula;
    ITokenManager public tokenManager;
    IVault public vault;

    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    uint32 public constant PPM = 1000000;

    uint256 public protocolBuyFeePct;
    uint256 public protocolSellFeePct;
    uint256 public subjectBuyFeePct;
    uint256 public subjectSellFeePct;

    address public feeBeneficiary;
    address public subjectFactory;

    mapping(address => uint32) public reserveRatio;

    function initialize(
        address _token,
        address _formula,
        address _owner,
        address _tokenManager,
        address _vault,
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct,
        address _beneficiary,
        address _subjectFactory
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();

        require(_formulaIsValid(_formula), ERROR_INVALID_FORMULA);
        require(_owner != address(0), ERROR_INVALID_OWNER);
        require(_tokenManager != address(0), ERROR_INVALID_TOKEN_MANAGER);
        require(subjectFactory != address(0), ERROR_INVAID_SUBJECT_FACTORY);

        require(
            _feeIsValid(_protocolBuyFeePct) &&
                _feeIsValid(_protocolSellFeePct) &&
                _feeIsValid(_subjectBuyFeePct) &&
                _feeIsValid(_subjectSellFeePct),
            ERROR_INVALID_PERCENTAGE
        );

        require(_beneficiaryIsValid(_beneficiary), ERROR_INVALID_BENEFICIARY);

        token = IERC20Extended(_token);
        formula = IBancorFormula(formula);
        tokenManager = ITokenManager(_tokenManager);
        vault = IVault(_vault);
        protocolBuyFeePct = _protocolBuyFeePct;
        protocolSellFeePct = _protocolSellFeePct;
        subjectBuyFeePct = _subjectBuyFeePct;
        subjectSellFeePct = _subjectSellFeePct;
        feeBeneficiary = _beneficiary;
        subjectFactory = _subjectFactory;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    function _updateBeneficiary(address _beneficiary) internal {
        feeBeneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    function _updateFormula(IBancorFormula _formula) internal {
        formula = _formula;

        emit UpdateFormula(address(_formula));
    }

    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return _fee < PCT_BASE;
    }

    function _formulaIsValid(address _formula) internal pure returns (bool) {
        return _formula != address(0);
    }

    function _beneficiaryIsValid(
        address _beneficiary
    ) internal pure returns (bool) {
        return _beneficiary != address(0);
    }

    function _reserveRatioIsValid(
        uint32 _reserveRatio
    ) internal pure returns (bool) {
        return _reserveRatio <= PPM;
    }

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

    function _buyShares(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        IERC20Extended _subjectToken,
        uint32 _subjectReserveRatio
    ) internal returns (uint256 shares_) {
        // moxie
        token.safeTransferFrom(msg.sender, address(this), _depositAmount);

        (uint256 protocolFee, uint256 subjectFee) = calculateBuySideFee(
            _depositAmount
        );

        token.safeTransfer(_subject, subjectFee);
        token.safeTransfer(feeBeneficiary, protocolFee);
        uint256 vaultDeposit = _depositAmount - subjectFee - protocolFee;

        token.approve(address(vault), vaultDeposit);
        vault.deposit(_subject, address(token), vaultDeposit);

        uint256 subjectSupply = _subjectToken.totalSupply();
        uint256 subjectReserve = vault.balanceOf(_subject, address(token));

        shares_ = formula.calculatePurchaseReturn(
            subjectSupply,
            subjectReserve,
            _subjectReserveRatio,
            vaultDeposit
        );

        require(
            shares_ >= _minReturnAmountAfterFee,
            ERROR_SLIPPAGE_EXCEEDS_LIMIT
        );

        tokenManager.mint(_subject, _onBehalfOf, shares_);

        emit SubjectSharePurchased(
            _subject,
            address(token),
            _depositAmount,
            address(_subjectToken),
            shares_,
            _onBehalfOf
        );
    }

    function _sellShares(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        IERC20Extended _subjectToken,
        uint32 _subjectReserveRatio
    ) internal returns (uint256 returnedAmount_) {
        // burn subjectToken
        _subjectToken.safeTransferFrom(msg.sender, address(0), _sellAmount);

        uint256 subjectSupply = _subjectToken.totalSupply();
        uint256 subjectReserve = vault.balanceOf(_subject, address(token));

        uint256 returnAmountWithoutFee = formula.calculateSaleReturn(
            subjectSupply,
            subjectReserve,
            _subjectReserveRatio,
            _sellAmount
        );

        vault.transfer(
            _subject,
            address(_subjectToken),
            address(this),
            returnAmountWithoutFee
        );
        (uint256 protocolFee, uint256 subjectFee) = calculateSellSideFee(
            returnAmountWithoutFee
        );

        token.safeTransfer(_subject, subjectFee);
        token.safeTransfer(feeBeneficiary, protocolFee);
        returnedAmount_ = returnAmountWithoutFee - subjectFee - protocolFee;

        require(
            returnedAmount_ >= _minReturnAmountAfterFee,
            ERROR_SLIPPAGE_EXCEEDS_LIMIT
        );
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
     * @notice Update fee
     * @param _protocolBuyFeePct protocol buy action fee.
     * @param _protocolSellFeePct protocol sell action fee.
     * @param _subjectBuyFeePct subject buy action fee.
     * @param _subjectSellFeePct subject sell action fee.
     */
    function updateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct
    ) external onlyRole(UPDATE_FEES_ROLE) {
        require(
            _feeIsValid(_protocolBuyFeePct) &&
                _feeIsValid(_protocolSellFeePct) &&
                _feeIsValid(_subjectBuyFeePct) &&
                _feeIsValid(_subjectSellFeePct),
            ERROR_INVALID_PERCENTAGE
        );
        _updateFees(
            _protocolBuyFeePct,
            _protocolSellFeePct,
            _subjectBuyFeePct,
            _subjectSellFeePct
        );
    }

    /**
     * @notice Update formula to `_formula`
     * @param _formula The address of the new BancorFormula [computation] contract
     */
    function updateFormula(
        address _formula
    ) external onlyRole(UPDATE_FORMULA_ROLE) {
        require(_formulaIsValid(_formula), ERROR_INVALID_FORMULA);

        _updateFormula(IBancorFormula(_formula));
    }

    /**
     * @notice Update beneficiary to `_beneficiary`
     * @param _beneficiary The address of the new beneficiary [to whom fees are to be sent]
     */
    function updateBeneficiary(
        address _beneficiary
    ) external onlyRole(UPDATE_BENEFICIARY_ROLE) {
        require(_beneficiaryIsValid(_beneficiary), ERROR_INVALID_BENEFICIARY);

        _updateBeneficiary(_beneficiary);
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
    ) external returns (bool) {
        require(_subject != address(0), ERROR_INVALID_SUBJECT);
        require(msg.sender == subjectFactory, ERROR_ONLY_SUBJECT_FACTORY);
        require(
            _reserveRatioIsValid(reserveRatio[_subject]),
            ERROR_INVALID_RESERVE_RATIO
        );

        require(reserveRatio[_subject] == 0, ERROR_SUBJECT_ALREADY_INITIALIZED);

        uint256 supply = tokenManager.tokens(_subject).totalSupply();

        require(_initialSupply != supply, ERROR_INVALID_SUBJECT_SUPPLY);

        reserveRatio[_subject] = _reserveRatio;
        token.safeTransferFrom(msg.sender, address(this), _reserveAmount);
        token.approve(address(vault), _reserveAmount);
        vault.deposit(_subject, address(token), _reserveAmount);

        emit BondingCurveInitialized(
            _subject,
            _initialSupply,
            _reserveAmount,
            _reserveRatio
        );

        return true;
    }

    function calculateBuySideFee(
        uint256 _depositAmount
    ) internal view returns (uint256 protocolFee_, uint256 subjectFee_) {
        protocolFee_ = (_depositAmount * protocolBuyFeePct) / PCT_BASE;
        subjectFee_ = (_depositAmount * subjectBuyFeePct) / PCT_BASE;
    }

    function calculateSellSideFee(
        uint256 _sellAmount
    ) internal view returns (uint256 protocolFee_, uint256 subjectFee_) {
        protocolFee_ = (_sellAmount * protocolSellFeePct) / PCT_BASE;
        subjectFee_ = (_sellAmount * subjectSellFeePct) / PCT_BASE;
    }

    //todo add moxie pass check
    //todo decide if onBehalfOf can be address(0)
    function buyShares(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external returns (uint256 shares_) {
        require(_subject != address(0), ERROR_INVALID_SUBJECT);

        uint32 subjectReserveRatio = reserveRatio[_subject];
        require(subjectReserveRatio != 0, ERROR_SUBJECT_NOT_INITIALIZED);

        require(_depositAmount > 0, ERROR_INVALID_SUBJECT);

        IERC20Extended subjectToken = tokenManager.tokens(_subject);
        require(
            address(subjectToken) != address(0),
            ERROR_INVALID_SUBJECT_TOKEN
        );

        shares_ = _buyShares(
            _subject,
            _depositAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee,
            subjectToken,
            subjectReserveRatio
        );
    }

    function sellShares(
        address _subject,
        uint256 _sellAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external returns (uint256 returnAmount_) {
        require(_subject != address(0), ERROR_INVALID_SUBJECT);

        uint32 subjectReserveRatio = reserveRatio[_subject];
        require(subjectReserveRatio != 0, ERROR_SUBJECT_NOT_INITIALIZED);

        require(_sellAmount > 0, ERROR_INVALID_SUBJECT);

        IERC20Extended subjectToken = tokenManager.tokens(_subject);
        require(
            address(subjectToken) != address(0),
            ERROR_INVALID_SUBJECT_TOKEN
        );

        returnAmount_ = _sellShares(
            _subject,
            _sellAmount,
            _onBehalfOf,
            _minReturnAmountAfterFee,
            subjectToken,
            subjectReserveRatio
        );
    }
}

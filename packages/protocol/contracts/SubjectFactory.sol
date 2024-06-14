// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./SecurityModule.sol";
import "./interfaces/ISubjectFactory.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IMoxieBondingCurve.sol";
import "./interfaces/IEasyAuction.sol";

contract SubjectFactory is SecurityModule, ISubjectFactory {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant ONBOARDING_ROLE = keccak256("ONBOARDING_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE =
        keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant AUCTION_ROLE = keccak256("AUCTION_ROLE");

    /// @dev Represent Percentage for fee 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    uint256 public constant PCT_BASE = 10 ** 18;

    error SubjectFactory_InvalidBeneficiary();
    error SubjectFactory_InvalidFeePercentage();
    error SubjectFactory_InvalidSubject();
    error SubjectFactory_InvalidTokenManager();
    error SubjectFactory_InvalidMoxieBondingCurve();
    error SubjectFactory_InvalidToken();
    error SubjectFactory_InvalidAuctionDuration();
    error SubjectFactory_InvalidAuctionOrderCancellationDuration();
    error SubjectFactory_InvalidAuctionContract();
    error SubjectFactory_AuctionAlreadyCreated();
    error SubjectFactory_AuctionNotCreated();
    error SubjectFactory_AuctionNotDoneYet();
    error SubjectFactory_InvalidOwner();
    error SubjectFactory_InvalidReserveRatio();
    error SubjectFactory_BuyAmountTooLess();

    ITokenManager public tokenManager;
    IMoxieBondingCurve public moxieBondingCurve;
    uint256 public protocolFeePct;
    uint256 public subjectFeePct;

    address public feeBeneficiary;
    address public subjectFactory;
    IEasyAuction public easyAuction;

    uint256 public auctionDuration;
    uint256 public auctionOrderCancellationDuration;

    IERC20Extended public token;

    mapping(address => Auction) public auctions;

    /**
     * @dev Initialize the contract.
     * @param _owner Owner of the contract;
     * @param _tokenManager Address of token manager contract.
     * @param _moxieBondingCurve  Address of Bonding curve contract.
     * @param _token  Address of moxie token.
     * @param _easyAuction Address of Easy auction contract.
     * @param _feeInput Fee input struct
     * @param _feeBeneficiary Protocol fee beneficiary.
     * @param _auctionDuration Duration of auction in unixtimestamp.
     * @param _auctionOrderCancellationDuration  duration of auction order  cancellation in unixtimestamp.
     */
    function initialize(
        address _owner,
        address _tokenManager,
        address _moxieBondingCurve,
        address _token,
        address _easyAuction,
        FeeInput memory _feeInput,
        address _feeBeneficiary,
        uint256 _auctionDuration,
        uint256 _auctionOrderCancellationDuration
    ) external initializer {
        if (_owner == address(0)) revert SubjectFactory_InvalidOwner();

        if (_tokenManager == address(0))
            revert SubjectFactory_InvalidTokenManager();
        if (_moxieBondingCurve == address(0))
            revert SubjectFactory_InvalidMoxieBondingCurve();
        if (_token == address(0)) revert SubjectFactory_InvalidToken();
        if (_easyAuction == address(0))
            revert SubjectFactory_InvalidAuctionContract();

        if (
            !_feeIsValid(_feeInput.protocolFeePct) ||
            !_feeIsValid(_feeInput.subjectFeePct)
        ) revert SubjectFactory_InvalidFeePercentage();

        if (!_feeBeneficiaryIsValid(_feeBeneficiary))
            revert SubjectFactory_InvalidBeneficiary();

        if (_auctionDuration == 0)
            revert SubjectFactory_InvalidAuctionDuration();

        if (_auctionOrderCancellationDuration == 0)
            revert SubjectFactory_InvalidAuctionOrderCancellationDuration();

        protocolFeePct = _feeInput.protocolFeePct;
        subjectFeePct = _feeInput.subjectFeePct;
        feeBeneficiary = _feeBeneficiary;
        token = IERC20Extended(_token);
        auctionDuration = _auctionDuration;
        auctionOrderCancellationDuration = _auctionOrderCancellationDuration;
        easyAuction = IEasyAuction(_easyAuction);
        tokenManager = ITokenManager(_tokenManager);
        moxieBondingCurve = IMoxieBondingCurve(_moxieBondingCurve);

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    /**
     * @dev check if fee is valid.
     * @param _fee Fee percentage in PCT_BASE.
     */
    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return _fee < PCT_BASE;
    }

    /**
     * @dev Check if fee beneficiary is valid.
     * @param _beneficiary Address of beneficiary.
     */
    function _feeBeneficiaryIsValid(
        address _beneficiary
    ) internal pure returns (bool) {
        return _beneficiary != address(0);
    }

    /**
     * @dev update fee beneficiary
     * @param _beneficiary Address of beneficiary.
     */
    function _updateFeeBeneficiary(address _beneficiary) internal {
        feeBeneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    /**
     * @dev Update fee params
     * @param _protocolFeePct Protocol fee in PCT.
     * @param _subjectFeePct Subject fee in PCT.
     */
    function _updateFees(
        uint256 _protocolFeePct,
        uint256 _subjectFeePct
    ) internal {
        protocolFeePct = _protocolFeePct;
        subjectFeePct = _subjectFeePct;

        emit UpdateFees(protocolFeePct, subjectFeePct);
    }

    /**
     * @dev Create auction for a subject.
     * @param _subject Address of subject.
     * @param _auctionInput Input params for auction.
     * @return auctionId_ Auction Id.
     * @return auctionEndDate_ Auction end date.
     */
    function _createAuction(
        address _subject,
        address _subjectToken,
        SubjectAuctionInput memory _auctionInput
    ) internal returns (uint256 auctionId_, uint256 auctionEndDate_) {
        auctionEndDate_ = block.timestamp + auctionDuration;
        auctionId_ = easyAuction.initiateAuction(
            _subjectToken,
            address(token),
            block.timestamp + auctionOrderCancellationDuration,
            auctionEndDate_,
            _auctionInput.initialSupply,
            _auctionInput.minBuyAmount,
            _auctionInput.minBiddingAmount,
            _auctionInput.minFundingThreshold,
            _auctionInput.isAtomicClosureAllowed,
            _auctionInput.accessManagerContract,
            _auctionInput.accessManagerContractData
        );

        auctions[_subject].auctionId = auctionId_;
        auctions[_subject].auctionEndDate = auctionEndDate_;
        auctions[_subject].initialSupply = _auctionInput.initialSupply;
    }

    /**
     * @dev Decode the clearing order from auction.
     * @param _orderData Orderdata returned from easy auction contract.
     * @return userId UserId in auction contract. Not needed.
     * @return buyAmount Amount of Moxie token.
     * @return sellAmount Amount of Subject Token.
     */
    function _decodeOrder(
        bytes32 _orderData
    )
        internal
        pure
        returns (uint64 userId, uint96 buyAmount, uint96 sellAmount)
    {
        // Note: converting to uint discards the binary digits that do not fit
        // the type.
        userId = uint64(uint256(_orderData) >> 192);
        buyAmount = uint96(uint256(_orderData) >> 96);
        sellAmount = uint96(uint256(_orderData));
    }

    /**
     * @dev Close auction & burn tokens which are not sold in auction.
     * @param _auctionId Auction Id.
     * @param _initialSupply Initial supply of auction.
     * @return soldSupply_ Total supply that got sold.
     * @return amountRaised_ Amount of moxie raised.
     * @return clearingOrder Clearning order to calculate price of auction.
     */
    function _closeAuction(
        uint256 _auctionId,
        // address _subjectToken,
        address _subject,
        uint256 _initialSupply
    )
        internal
        returns (
            uint256 soldSupply_,
            uint256 amountRaised_,
            bytes32 clearingOrder
        )
    {
        address subjectToken = tokenManager.tokens(_subject);
        uint256 beforeBalanceInSubjectToken = IERC20Extended(subjectToken)
            .balanceOf(address(this));
        uint256 beforeBalanceInMoxieToken = IERC20Extended(token).balanceOf(
            address(this)
        );

        clearingOrder = easyAuction.settleAuction(_auctionId);

        uint256 afterBalanceInSubjectToken = IERC20Extended(subjectToken)
            .balanceOf(address(this));
        uint256 afterBalanceInMoxieToken = IERC20Extended(token).balanceOf(
            address(this)
        );

        soldSupply_ =
            _initialSupply -
            (afterBalanceInSubjectToken - beforeBalanceInSubjectToken);
        amountRaised_ = afterBalanceInMoxieToken - beforeBalanceInMoxieToken;

        uint256 amountToBurn = _initialSupply - soldSupply_;

        // Burn subject token which are not sold in auction.
        if (amountToBurn > 0) {
            IERC20Extended(subjectToken).burn(amountToBurn);
        }
    }

    /**
     * @dev Internal function to calculate fees.
     * @param _amount Amount against fee should be calculated..
     * @return protocolFee_ protocol fee in PCT_BASE.
     * @return subjectFee_  subject fee in PCT_BASE.
     */
    function _calculateFee(
        uint256 _amount
    ) internal view returns (uint256 protocolFee_, uint256 subjectFee_) {
        protocolFee_ = (_amount * protocolFeePct) / PCT_BASE;
        subjectFee_ = (_amount * subjectFeePct) / PCT_BASE;
    }

    /**
     * @dev Calculate Tokens to mint for given input amount based on auction price.
     * @param _clearningOrder Clearing order from auction.
     * @param _amount Amount of reserve tokens from onboarding.
     */
    function _calculateTokensMintAfterAuction(
        bytes32 _clearningOrder,
        uint256 _amount
    ) internal pure returns (uint256) {
        /// @dev buyAmount is moxie amount & sell amount is subject token.
        (, uint96 buyAmount, uint96 sellAmount) = _decodeOrder(_clearningOrder);
        return (buyAmount * _amount) / sellAmount;
    }

    /**
     * @dev Initialize Bonding curve ,also mint bonding supply for onboarding reserve amount.
     * @param _auctionId Auction Id from easy auction contract for subject onboarding.
     * @param _subject Address of subject.
     * @param _amountRaised Amount raised in auction.
     * @param _supply Total supply sold in auction.
     * @param _reserveRatio Reserve ratio for Bonding curve.
     * @param _clearningOrder Clearing order from auction.
     * @param _buyAmount Amount to mint shares to this contract at auction price.
     */
    function _initializeBondingCurve(
        uint256 _auctionId,
        address _subject,
        uint256 _amountRaised,
        uint256 _supply,
        uint32 _reserveRatio,
        bytes32 _clearningOrder,
        uint256 _buyAmount
    ) internal {
        uint256 newSupplyToMint = _calculateTokensMintAfterAuction(
            _clearningOrder,
            _buyAmount
        );

        if (newSupplyToMint == 0) {
            revert SubjectFactory_BuyAmountTooLess();
        }
        /// @dev this supply will always be locked in this  contract to make sure Bonding curve always have non zero price.
        tokenManager.mint(_subject, address(this), newSupplyToMint);

        (uint256 protocolFee_, uint256 subjectFee_) = _calculateFee(
            _amountRaised + _buyAmount // total amount is sum of auction amount + reserve amount from onboarding flow.
        );
        uint256 bondingAmount_ = _amountRaised +
            _buyAmount -
            protocolFee_ -
            subjectFee_;

        // approve bonding curve to spend moxie
        IERC20Extended(token).approve(
            address(moxieBondingCurve),
            bondingAmount_
        );

        uint256 bondingSupply_ = _supply + newSupplyToMint;
        moxieBondingCurve.initializeSubjectBondingCurve(
            _subject,
            _reserveRatio,
            bondingSupply_,
            bondingAmount_
        );

        token.safeTransfer(feeBeneficiary, protocolFee_);
        token.safeTransfer(_subject, subjectFee_);

        emit SubjectOnboardingFinished(
            _subject,
            tokenManager.tokens(_subject),
            _auctionId,
            bondingSupply_,
            bondingAmount_,
            protocolFee_,
            subjectFee_
        );
    }

    /**
     * @dev Function to onboard & start auction of initial supply of subject.
     * @param _subject Address of subject.
     * @param _auctionInput Input for auction creation.
     */
    function initiateSubjectOnboarding(
        address _subject,
        SubjectAuctionInput memory _auctionInput
    )
        external
        whenNotPaused
        onlyRole(ONBOARDING_ROLE)
        returns (uint256 auctionId_)
    {
        if (_subject == address(0)) revert SubjectFactory_InvalidSubject();

        if (auctions[_subject].auctionId != 0)
            revert SubjectFactory_AuctionAlreadyCreated();

        address subjectToken = tokenManager.create(
            _subject,
            _auctionInput.name,
            _auctionInput.symbol,
            _auctionInput.initialSupply,
            _auctionInput.accessManagerContract
        );

        IERC20Extended(subjectToken).approve(
            address(easyAuction),
            _auctionInput.initialSupply
        );

        (uint256 auctionId, uint256 auctionEndDate) = _createAuction(
            _subject,
            subjectToken,
            _auctionInput
        );

        auctionId_ = auctionId;

        emit SubjectOnboardingInitiated(
            _subject,
            subjectToken,
            _auctionInput.initialSupply,
            address(token),
            auctionEndDate,
            auctionId_
        );
    }

    /**
     * @dev Finalize subject onboarding.
     *  1. Close auction
     *  2. Burn unsold supply
     *  3. Calculate additional mint for onboarding reserve
     *  4. Calculate & transfer fee.
     *  5. Initiate bonding curve.
     * @param _subject Address of subject token.
     * @param _buyAmount Amount of tokens contract will use to buy shares of subject token after auction is done.
     * This is to make sure there is always a supply before initiating bonding curve. Subject token against this
     * reserve will be locked in this contract forever.
     * @param _reserveRatio Reserve ratio of bonding curve.
     */
    function finalizeSubjectOnboarding(
        address _subject,
        uint256 _buyAmount,
        uint32 _reserveRatio
    ) external whenNotPaused onlyRole(ONBOARDING_ROLE) {
        if (_subject == address(0)) revert SubjectFactory_InvalidSubject();
        if (_reserveRatio == 0) revert SubjectFactory_InvalidReserveRatio();

        Auction memory auction = auctions[_subject];
        uint256 auctionId = auction.auctionId;

        if (auctionId == 0) revert SubjectFactory_AuctionNotCreated();

        if (block.timestamp < auction.auctionEndDate)
            revert SubjectFactory_AuctionNotDoneYet();

        // transfer buy amount from caller to contract.
        token.safeTransferFrom(msg.sender, address(this), _buyAmount);
        delete auctions[_subject];

        (
            uint256 soldSupply,
            uint256 amountRaised,
            bytes32 clearingOrder
        ) = _closeAuction(auctionId, _subject, auction.initialSupply);

        _initializeBondingCurve(
            auctionId,
            _subject,
            amountRaised,
            soldSupply,
            _reserveRatio,
            clearingOrder,
            _buyAmount
        );
    }

    /**
     * @notice Update beneficiary to `_beneficiary. It can be done by UPDATE_BENEFICIARY_ROLE.
     * @param _feeBeneficiary The address of the new beneficiary [to whom fees are to be sent]
     */
    function updateFeeBeneficiary(
        address _feeBeneficiary
    ) external onlyRole(UPDATE_BENEFICIARY_ROLE) {
        if (!_feeBeneficiaryIsValid(_feeBeneficiary))
            revert SubjectFactory_InvalidBeneficiary();

        _updateFeeBeneficiary(_feeBeneficiary);
    }

    /**
     * @notice Update fee only be called by role UPDATE_FEES_ROLE.
     * @param _feeInput Fee input struct.
     */
    function updateFees(
        FeeInput memory _feeInput
    ) external onlyRole(UPDATE_FEES_ROLE) {
        if (
            !_feeIsValid(_feeInput.protocolFeePct) ||
            !_feeIsValid(_feeInput.subjectFeePct)
        ) revert SubjectFactory_InvalidFeePercentage();

        _updateFees(_feeInput.protocolFeePct, _feeInput.subjectFeePct);
    }

    /**
     * @notice Update auction params.
     * @param _auctionDuration Duration of auction in timestamp.
     * @param _auctionOrderCancellationDuration  Duration on order cancellation in timestamp.
     */
    function updateAuctionTime(
        uint256 _auctionDuration,
        uint256 _auctionOrderCancellationDuration
    ) external onlyRole(AUCTION_ROLE) {
        if (_auctionDuration == 0)
            revert SubjectFactory_InvalidAuctionDuration();

        if (_auctionOrderCancellationDuration == 0)
            revert SubjectFactory_InvalidAuctionOrderCancellationDuration();

        auctionDuration = _auctionDuration;
        auctionOrderCancellationDuration = _auctionOrderCancellationDuration;

        emit UpdateAuctionParam(
            _auctionDuration,
            _auctionOrderCancellationDuration
        );
    }
}

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

    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

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

    ITokenManager public tokenManager;
    IMoxieBondingCurve public moxieBondingCurve;
    uint256 public protocolBuyFeePct;
    uint256 public protocolSellFeePct;
    uint256 public subjectBuyFeePct;
    uint256 public subjectSellFeePct;

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

        if(_owner == address(0))
            revert SubjectFactory_InvalidOwner();
        
        if (_tokenManager == address(0))
            revert SubjectFactory_InvalidTokenManager();
        if (_moxieBondingCurve == address(0))
            revert SubjectFactory_InvalidMoxieBondingCurve();
        if (_token == address(0)) revert SubjectFactory_InvalidToken();
        if (_easyAuction == address(0))
            revert SubjectFactory_InvalidAuctionContract();

        if (
            !_feeIsValid(_feeInput.protocolBuyFeePct) ||
            !_feeIsValid(_feeInput.protocolSellFeePct) ||
            !_feeIsValid(_feeInput.subjectBuyFeePct) ||
            !_feeIsValid(_feeInput.subjectSellFeePct)
        ) revert SubjectFactory_InvalidFeePercentage();

        if (!_feeBeneficiaryIsValid(_feeBeneficiary))
            revert SubjectFactory_InvalidBeneficiary();

        if (_auctionDuration == 0)
            revert SubjectFactory_InvalidAuctionDuration();

        if (_auctionOrderCancellationDuration == 0)
            revert SubjectFactory_InvalidAuctionOrderCancellationDuration();

        protocolBuyFeePct = _feeInput.protocolBuyFeePct;
        protocolSellFeePct = _feeInput.protocolSellFeePct;
        subjectBuyFeePct = _feeInput.subjectBuyFeePct;
        subjectSellFeePct = _feeInput.subjectSellFeePct;
        feeBeneficiary = _feeBeneficiary;
        token = IERC20Extended(_token);
        auctionDuration = _auctionDuration;
        auctionOrderCancellationDuration = _auctionOrderCancellationDuration;
        easyAuction = IEasyAuction(_easyAuction);
        tokenManager = ITokenManager(_tokenManager);
        moxieBondingCurve = IMoxieBondingCurve(_moxieBondingCurve);

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return _fee < PCT_BASE;
    }

    function _feeBeneficiaryIsValid(
        address _beneficiary
    ) internal pure returns (bool) {
        return _beneficiary != address(0);
    }

    function _updateFeeBeneficiary(address _beneficiary) internal {
        feeBeneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
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

    function _createAuction(
        address _subject,
        address _subjectToken,
        SubjectAuctionInput memory auctionInput,
        uint256 _reserveAmount
    ) internal returns (uint256 auctionId_, uint256 auctionEndDate_) {
        auctionEndDate_ = block.timestamp + auctionDuration;
        auctionId_ = easyAuction.initiateAuction(
            _subjectToken,
            address(token),
            block.timestamp + auctionOrderCancellationDuration,
            auctionEndDate_,
            auctionInput.initialSupply,
            auctionInput.minBuyAmount,
            auctionInput.minBiddingAmount,
            auctionInput.minFundingThreshold,
            auctionInput.isAtomicClosureAllowed,
            auctionInput.accessManagerContract,
            auctionInput.accessManagerContractData
        );

        auctions[_subject].auctionId = auctionId_;
        auctions[_subject].auctionEndDate = auctionEndDate_;
        auctions[_subject].reserveAmount = _reserveAmount;
    }

    /**
     * @dev Function to onboard & start auction of initial supply of subject.
     * @param _subject Address of subject.
     * @param _auctionInput Input for auction creation.
     * @param _reserveAmount Amount of tokens contract will use to buy shares of subject token after auction is done. 
     * This is to make sure there is always a supply before initiating bonding curve. Subject token against this
     * reserve will be locked in this contract forever. 
     */
    function initiateSubjectOnboarding(
        address _subject,
        SubjectAuctionInput memory _auctionInput,
        uint256 _reserveAmount
    )
        external
        whenNotPaused
        onlyRole(ONBOARDING_ROLE)
        returns (uint256 auctionId_)
    {
        if (_subject == address(0)) revert SubjectFactory_InvalidSubject();

        if (auctions[_subject].auctionId != 0)
            revert SubjectFactory_AuctionAlreadyCreated();

        // transfer reserve from caller to contract.
        token.safeTransferFrom(msg.sender, address(this), _reserveAmount);    

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
            _auctionInput,
            _reserveAmount
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

       function _decodeOrder(bytes32 _orderData)
        internal
        pure
        returns (
            uint64 userId,
            uint96 buyAmount, //moxie amount
            uint96 sellAmount //subject amount
        )
        
    {
        // Note: converting to uint discards the binary digits that do not fit
        // the type.
        userId = uint64(uint256(_orderData) >> 192);
        buyAmount = uint96(uint256(_orderData) >> 96);
        sellAmount = uint96(uint256(_orderData));
    }

    // /**
    //  * 
    //  * settle Close auction
    //  * Easy auction will send funds to auction creator during close auction
    //  * Subject factory needs to following
    //  *  1. Identify closing price
    //  *  2. For fix amount moxie, calculate subjects token based on closing price 
    //  * 3. Move fix amount to reserve
    //  * 4. Mint subject token calculated in step 2 for itself  
    //  * 5. Identify moxie tokens raised in auction & move it reserve 
    //  * 6. Identify subject tokens sold in auction, find remaining subject tokens which are not sold & burn them. 
    //  * 7. Initialize bonding curve
    
    //  */
    // function finalizeSubjectOnboarding(
    //     address _subject,
    //     uint32 _reserveRatio
    // ) external whenNotPaused onlyRole(ONBOARDING_ROLE) {
    //     if (_subject == address(0)) revert SubjectFactory_InvalidSubject();

    //     uint256 auctionId = auctions[_subject].auctionId;
    //     if (auctionId == 0) revert SubjectFactory_AuctionNotCreated();

    //     if (block.timestamp < auctions[_subject].auctionEndDate)
    //         revert SubjectFactory_AuctionNotDoneYet();

    //     uint256 finalSupply = 0; // how much sold in auction
    //     uint256 reserveAmount = 0; // how much moxie is raised


    //     bytes32 clearingOrder = easyAuction.settleAuction(auctionId);

    //     (uint64 userId, uint96 buyAmount, uint96 sellAmount ) = _decodeOrder(clearingOrder);



    //     //
    //     moxieBondingCurve.initializeSubjectBondingCurve(
    //         _subject,
    //         _reserveRatio,
    //         finalSupply,
    //         reserveAmount
    //     );
    // }

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
            !_feeIsValid(_feeInput.protocolBuyFeePct) ||
            !_feeIsValid(_feeInput.protocolSellFeePct) ||
            !_feeIsValid(_feeInput.subjectBuyFeePct) ||
            !_feeIsValid(_feeInput.subjectSellFeePct)
        ) revert SubjectFactory_InvalidFeePercentage();

        _updateFees(
            _feeInput.protocolBuyFeePct,
            _feeInput.protocolSellFeePct,
            _feeInput.subjectBuyFeePct,
            _feeInput.subjectSellFeePct
        );
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

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "./SecurityModule.sol";
import "./interfaces/ISubjectFactory.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IMoxieBondingCurve.sol";
import "./interfaces/IEasyAuction.sol";

contract SubjectFactory is SecurityModule, ISubjectFactory {
    bytes32 public constant ONBOARDING_ROLE = keccak256("ONBOARDING_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE =
        keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant AUCTION_ROLE = keccak256("AUCTION_ROLE");

    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    error InvalidBeneficiary();
    error InvalidFeePercentage();
    error InvalidSubject();
    error InvalidTokenManager();
    error InvalidMoxieBondingCurve();
    error InvalidToken();
    error InvalidAuctionDuration();
    error InvalidAuctionOrderCancellationDuration();
    error InvalidAuctionContract();
    error AuctionAlreadyCreated();
    error AuctionNotCreated();
    error AuctionNotDoneYet();

    ITokenManager tokenManager;
    IMoxieBondingCurve moxieBondingCurve;
    uint256 public protocolBuyFeePct;
    uint256 public protocolSellFeePct;
    uint256 public subjectBuyFeePct;
    uint256 public subjectSellFeePct;

    address public feeBeneficiary;
    address public subjectFactory;
    IEasyAuction public easyAuction;

    uint256 auctionDuration;
    uint256 auctionOrderCancellationDuration;

    IERC20Extended token;

    mapping(address => Auction) auctions;

    /**
     * @dev Initialize the contract.
     * @param _owner Owner of the contract;
     * @param _tokenManager Address of token manager contract.
     * @param _moxieBondingCurve  Address of Bonding curve contract.
     * @param _token  Address of moxie token.
     * @param _easyAuction Address of Easy auction contract.
     * @param _protocolBuyFeePct protocol buy side fee in PCT_BASE.
     * @param _protocolSellFeePct  protocol sell side fee in PCT_BASE.
     * @param _subjectBuyFeePct  subject buy side fee in PCT_BASE.
     * @param _subjectSellFeePct  subject sell side fee in PCT_BASE.
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
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct,
        address _feeBeneficiary,
        uint256 _auctionDuration,
        uint256 _auctionOrderCancellationDuration
    ) external initializer {
        if (_tokenManager == address(0)) revert InvalidTokenManager();
        if (_moxieBondingCurve == address(0)) revert InvalidMoxieBondingCurve();
        if (_token == address(0)) revert InvalidToken();
        if (_easyAuction == address(0)) revert InvalidAuctionContract();

        if (
            !_feeIsValid(_protocolBuyFeePct) ||
            _feeIsValid(_protocolSellFeePct) ||
            _feeIsValid(_subjectBuyFeePct) ||
            _feeIsValid(_subjectSellFeePct)
        ) revert InvalidFeePercentage();

        if (!_feeBeneficiaryIsValid(_feeBeneficiary))
            revert InvalidBeneficiary();

        if (_auctionDuration == 0) revert InvalidAuctionDuration();

        if (_auctionOrderCancellationDuration == 0)
            revert InvalidAuctionOrderCancellationDuration();

        protocolBuyFeePct = _protocolBuyFeePct;
        protocolSellFeePct = _protocolSellFeePct;
        subjectBuyFeePct = _subjectBuyFeePct;
        subjectSellFeePct = _subjectSellFeePct;
        feeBeneficiary = _feeBeneficiary;
        token = IERC20Extended(_token);
        auctionDuration = _auctionDuration;
        auctionOrderCancellationDuration = _auctionOrderCancellationDuration;
        easyAuction = IEasyAuction(_easyAuction);

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

    /**
     * @dev Function to onboard & start auction of initial supply of subject.
     * @param _subject Address of subject.
     * @param auctionInput Input for auction creation.
     */
    function initiateSubjectOnboarding(
        address _subject,
        SubjectAuctionInput memory auctionInput
    )
        external
        whenNotPaused
        onlyRole(ONBOARDING_ROLE)
        returns (uint256 auctionId_)
    {
        if (_subject == address(0)) revert InvalidSubject();

        if (auctions[_subject].auctionId != 0) revert AuctionAlreadyCreated();

        address subjectToken = tokenManager.create(
            _subject,
            auctionInput.name,
            auctionInput.symbol,
            auctionInput.initialSupply,
            auctionInput.accessManagerContract
        );

        IERC20Extended(subjectToken).approve(
            address(easyAuction),
            auctionInput.initialSupply
        );

        uint256 auctionEndDate = block.timestamp + auctionDuration;
        auctionId_ = easyAuction.initiateAuction(
            subjectToken,
            address(token),
            block.timestamp + auctionOrderCancellationDuration,
            block.timestamp + auctionDuration,
            auctionInput.initialSupply,
            auctionInput.minBuyAmount,
            auctionInput.minBiddingAmount,
            auctionInput.minFundingThreshold,
            auctionInput.isAtomicClosureAllowed,
            auctionInput.accessManagerContract,
            auctionInput.accessManagerContractData
        );

        auctions[_subject].auctionId = auctionId_;
        auctions[_subject].auctionEndDate = auctionEndDate;

        emit SubjectOnboardingInitiated(
            _subject,
            subjectToken,
            auctionInput.initialSupply,
            address(token),
            auctionEndDate,
            auctionId_
        );
    }

    function finalizeSubjectOnboarding(
        address _subject,
        uint32 _reserveRatio
    ) external whenNotPaused onlyRole(ONBOARDING_ROLE) {
        if (_subject == address(0)) revert InvalidSubject();

        uint256 auctionId = auctions[_subject].auctionId;
        if (auctionId == 0) revert AuctionNotCreated();

        if (block.timestamp < auctions[_subject].auctionEndDate)
            revert AuctionNotDoneYet();

        uint256 finalSupply = 0;
        uint256 reserveAmount = 0;

        easyAuction.settleAuction(auctionId);
        moxieBondingCurve.initializeSubjectBondingCurve(
            _subject,
            _reserveRatio,
            finalSupply,
            reserveAmount
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
            revert InvalidBeneficiary();

        _updateFeeBeneficiary(_feeBeneficiary);
    }

    /**
     * @notice Update fee only be called by role UPDATE_FEES_ROLE.
     * @param _protocolBuyFeePct protocol buy action fee in PCT_BASE.
     * @param _protocolSellFeePct protocol sell action fee in PCT_BASE.
     * @param _subjectBuyFeePct subject buy action fee in PCT_BASE.
     * @param _subjectSellFeePct subject sell action fee in PCT_BASE.
     */
    function updateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct
    ) external onlyRole(UPDATE_FEES_ROLE) {
        if (
            !_feeIsValid(_protocolBuyFeePct) ||
            !_feeIsValid(_protocolSellFeePct) ||
            !_feeIsValid(_subjectBuyFeePct) ||
            !_feeIsValid(_subjectSellFeePct)
        ) revert InvalidFeePercentage();

        _updateFees(
            _protocolBuyFeePct,
            _protocolSellFeePct,
            _subjectBuyFeePct,
            _subjectSellFeePct
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
        if (_auctionDuration == 0) revert InvalidAuctionDuration();

        if (_auctionOrderCancellationDuration == 0)
            revert InvalidAuctionOrderCancellationDuration();

        auctionDuration = _auctionDuration;
        auctionOrderCancellationDuration = _auctionOrderCancellationDuration;

        emit UpdateAuctionParam(
            _auctionDuration,
            _auctionOrderCancellationDuration
        );
    }
}

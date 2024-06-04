// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

contract ISubjectFactory {
    event SubjectOnboardingInitiated(
        address _subject,
        address _subjectToken,
        uint256 _auctionAmount,
        address _biddingToken,
        uint256 auctionEndDate,
        uint256 _auctionId
    );

    event UpdateBeneficiary(address _beneficiary);
    event UpdateFees(
        uint256 _protocolBuyFeePct,
        uint256 _protocolSellFeePct,
        uint256 _subjectBuyFeePct,
        uint256 _subjectSellFeePct
    );

    event UpdateAuctionParam(
        uint256 _auctionDuration,
        uint256 _auctionOrderCancellationDuration
    );

    struct Auction {
        uint256 auctionId;
        uint256 auctionEndDate;
    }

    struct SubjectAuctionInput {
        string name;
        string symbol;
        uint96 initialSupply;
        uint96 minBuyAmount;
        uint256 minBiddingAmount;
        uint256 minFundingThreshold;
        bool isAtomicClosureAllowed;
        address accessManagerContract;
        bytes accessManagerContractData;
    }
}
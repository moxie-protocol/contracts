// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

contract ISubjectFactoryV2 {
    event SubjectOnboardingInitiated(
        address indexed _subject,
        address indexed _subjectToken,
        uint256 _auctionAmount,
        address _biddingToken,
        uint256 auctionEndDate,
        uint256 _auctionId
    );

    //In subjectToken
    event SubjectOnboardingFinished( //In moxie token
        address indexed _subject,
        address indexed _subjectToken,
        uint256 _auctionId,
        uint256 _bondingSupply,
        uint256 _bondingAmount,
        uint256 _protocolFee,
        uint256 _subjectFee,
        uint256 _subjectFeeInSubjectToken
    );

    event UpdateBeneficiary(address _beneficiary);
    event UpdateFees(uint256 _protocolFeePct, uint256 _subjectFeePct);

    event UpdateAuctionParam(uint256 _auctionDuration, uint256 _auctionOrderCancellationDuration);

    struct Auction {
        uint256 auctionId;
        uint256 auctionEndDate;
        uint256 initialSupply;
        address platformReferrer;
    }

    struct SubjectAuctionInput {
        string name;
        string symbol;
        uint96 initialSupply;
        uint96 minBuyAmount; // in moxie token
        uint256 minBiddingAmount; // in subject token
        uint256 minFundingThreshold; // amount of auction funding in moxie token below which auction will be cancelled.
        bool isAtomicClosureAllowed; // false can be hardcoded
        address accessManagerContract; //
        bytes accessManagerContractData; //0x00 can be hardcoded
    }

    struct FeeInput {
        uint256 protocolFeePct;
        uint256 subjectFeePct;
    }
}

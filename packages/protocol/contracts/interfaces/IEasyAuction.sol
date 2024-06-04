// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface IEasyAuction {

    function initiateAuction(
        address _auctioningToken,
        address _biddingToken,
        uint256 orderCancellationEndDate,
        uint256 auctionEndDate,
        uint96 _auctionedSellAmount,
        uint96 _minBuyAmount,
        uint256 minimumBiddingAmountPerOrder,
        uint256 minFundingThreshold,
        bool isAtomicClosureAllowed,
        address accessManagerContract,
        bytes memory accessManagerContractData
    ) external returns (uint256);

    function settleAuction(uint256 _auctionId) external  returns (bytes32 clearingOrder);
}

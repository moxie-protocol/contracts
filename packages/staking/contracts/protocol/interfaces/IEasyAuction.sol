// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface IEasyAuction {

    function initiateAuction(
        address _auctioningToken,
        address _biddingToken,
        uint256 _orderCancellationEndDate,
        uint256 _auctionEndDate,
        uint96 _auctionedSellAmount,
        uint96 _minBuyAmount,
        uint256 _minimumBiddingAmountPerOrder,
        uint256 _minFundingThreshold,
        bool _isAtomicClosureAllowed,
        address _accessManagerContract,
        bytes memory _accessManagerContractData
    ) external returns (uint256);

    function settleAuction(uint256 _auctionId) external  returns (bytes32 clearingOrder);
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "../interfaces/IEasyAuction.sol";

contract MockEasyAuction is IEasyAuction {
    uint256 public auctionId;
    bytes32 public clearingOrder;

    function encodeOrder(
        uint64 userId,
        uint96 buyAmount,
        uint96 sellAmount
    ) internal pure returns (bytes32) {
        return
            bytes32(
                (uint256(userId) << 192) +
                    (uint256(buyAmount) << 96) +
                    uint256(sellAmount)
            );
    }

    function setAuctionId(uint256 _auctionId) external {
        auctionId = _auctionId;
    }

    function setClearningOrder(
        uint64 userId,
        uint96 buyAmount,
        uint96 sellAmount
    ) external {
        clearingOrder = encodeOrder(userId, buyAmount, sellAmount);
    }

    function initiateAuction(
        address /*_auctioningToken*/,
        address /*_biddingToken*/,
        uint256 /*orderCancellationEndDate*/,
        uint256 /*auctionEndDate*/,
        uint96 /*_auctionedSellAmount*/,
        uint96 /*_minBuyAmount*/,
        uint256 /*minimumBiddingAmountPerOrder*/,
        uint256 /*minFundingThreshold*/,
        bool /*isAtomicClosureAllowed*/,
        address /*accessManagerContract*/,
        bytes memory /*accessManagerContractData*/
    ) external view override returns (uint256) {
        return auctionId;
        
    }

    function settleAuction(
        uint256 /*_auctionId*/
    ) external view override returns (bytes32) {
        return clearingOrder;
    }

}

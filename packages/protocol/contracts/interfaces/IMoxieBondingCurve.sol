// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface IMoxieBondingCurve {
    struct FeeInput {
        uint256 protocolBuyFeePct;
        uint256 protocolSellFeePct;
        uint256 subjectBuyFeePct;
        uint256 subjectSellFeePct;
    }

    function initializeSubjectBondingCurve(
        address _subject,
        uint32 _reserveRatio,
        uint256 _initialSupply,
        uint256 _reserveAmount
    ) external returns (bool);

    function buySharesFor(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external returns (uint256 shares_);

    function buyShares(address _subject, uint256 _depositAmount, uint256 _minReturnAmountAfterFee)
        external
        returns (uint256 shares_);
}

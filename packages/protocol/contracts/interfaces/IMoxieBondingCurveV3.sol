// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {IGraduationHook} from "./IGraduationHook.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";

interface IMoxieBondingCurveV3 {
    struct FeeInput {
        uint256 protocolBuyFeePct;
        uint256 protocolSellFeePct;
        uint256 subjectBuyFeePct;
        uint256 subjectSellFeePct;
        uint256 swapFeeRatioProtocolPct;
    }

    function initializeSubjectBondingCurve(
        address _subject,
        uint32 _reserveRatio,
        uint256 _initialSupply,
        uint256 _reserveAmount,
        address _platformReferrer
    ) external returns (bool);

    function buySharesFor(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee
    ) external returns (uint256 shares_);


    function buyShares(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee
    ) external returns (uint256 shares_);


    function buySharesForV2(
        address _subject,
        uint256 _depositAmount,
        address _onBehalfOf,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external returns (uint256 shares_);


    function buySharesV2(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        address _orderReferrer
    ) external returns (uint256 shares_);

        function initialize(
        address _token,
        address _formula,
        address _owner,
        address _tokenManager,
        address _vault,
        FeeInput memory _feeInput,
        address _feeBeneficiary,
        address _subjectFactory
    ) external;

    function reinitialize(
        uint256 _defaultGraduationMarketCap,
        IGraduationHook _hook,
        IPositionManager _positionManager,
        IUniversalRouter _router,
        uint256 _swapFeeRatioProtocolPct
    ) external;
}

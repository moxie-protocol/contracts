// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {BaseHook, IPoolManager, PoolKey, Hooks} from "@uniswap/briefcase/src/protocols/v4-periphery/utils/BaseHook.sol";
import {IGraduationHook} from "../interfaces/IGraduationHook.sol";

contract GraduationHook is BaseHook, IGraduationHook {
    address public immutable moxieBondingCurve;

    error Unauthorized();

    constructor(IPoolManager _manager, address _moxieBondingCurve) BaseHook(_manager) {
        moxieBondingCurve = _moxieBondingCurve;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _afterInitialize(address sender, PoolKey calldata, uint160, int24) internal view override returns (bytes4) {
        if (sender != moxieBondingCurve) revert Unauthorized();
        return BaseHook.afterInitialize.selector;
    }
}

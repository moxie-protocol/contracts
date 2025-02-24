// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/briefcase/src/protocols/v4-core/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolKey} from "@uniswap/briefcase/src/protocols/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/briefcase/src/protocols/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/briefcase/src/protocols/v4-core/interfaces/IHooks.sol";


contract FakeDonator {
    IPoolManager public manager;

    constructor(IPoolManager _manager) {   
        manager = _manager;
    }

    function donate(address hook, address moxie, address subject) external {
        manager.unlock(abi.encode(hook, moxie, subject));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "Unauthorized");

        (address hook, address moxie, address subject) = abi.decode(data, (address, address, address));
        (address token0, address token1) = moxie < subject ? (moxie, subject) : (subject, moxie);
        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));


        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 10000,
            tickSpacing: 200,
            hooks: IHooks(hook)
        });

        manager.donate(key, amount0, amount1, "");
        manager.sync(Currency.wrap(address(token0)));
        require(IERC20(token0).transfer(address(manager), amount0), "Token0 transfer failed");
        manager.settle();
        manager.sync(Currency.wrap(address(token1)));
        require(IERC20(token1).transfer(address(manager), amount1), "Token1 transfer failed");
        manager.settle();
        // Return empty bytes to indicate success
        return "";
    }
}
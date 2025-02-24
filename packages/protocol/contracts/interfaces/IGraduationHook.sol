// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {IHooks} from "@uniswap/briefcase/src/protocols/v4-core/interfaces/IHooks.sol";
import {IImmutableState} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IImmutableState.sol";
interface IGraduationHook is IHooks, IImmutableState {
}

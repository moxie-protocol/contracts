// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Extended is IERC20 {
    function mint(address beneficiary, uint256 amount) external;

    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 value) external;
}

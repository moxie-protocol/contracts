// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;
import "./MoxieBondingCurve.sol";

/**
 * @title Moxie Bonding curve
 * @author Moxie Team
 * @notice Bonding curve contract which enables subject onboarding, buy & sell of subject shares.
 */
contract MoxieBondingCurveV2 is MoxieBondingCurve {
    uint256 public constant version = 2;
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../MoxiePassVerifier.sol";

contract MockMoxiePassVerifier is MoxiePassVerifier {
    constructor(address _ownerAddress) MoxiePassVerifier(_ownerAddress) {}

    function testModifier() external view onlyMoxiePassHolder returns (bool) {
        return true;
    }
}

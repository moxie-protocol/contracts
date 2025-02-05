// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface ISubjectErc20 {

    function initialize(
        address initialOwner,
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        address _moxiePassVerifier
    ) external;
}

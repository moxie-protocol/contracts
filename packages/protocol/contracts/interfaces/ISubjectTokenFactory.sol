// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

interface ISubjectTokenFactory {
    event SubjectTokenCreated(address subject, address tokenAddress, uint256 initialSupply);

    function create(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) external returns (address token_);
}

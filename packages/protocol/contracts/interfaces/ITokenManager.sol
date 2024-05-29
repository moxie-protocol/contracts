// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "./IERC20Extended.sol";

interface ITokenManager {
    event TokenDeployed(address subject, address token, uint256 initialSupply);
    event TokenMinted(address subject, address token, uint256 amount);

    function tokens(address _subject) external returns(IERC20Extended token_address);

    function create(
        address _subject,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external returns (address token_);

    function mint(
        address _subject,
        address _beneficiary,
        uint256 _amount
    ) external returns (bool);
}

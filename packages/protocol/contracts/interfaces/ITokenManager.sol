// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "./IERC20Extended.sol";

interface ITokenManager {
    error InvalidSubjectImplementation();
    error SubjectExists();
    error InvalidSubject();
    error TokenNotFound();
    error InvalidOwner();
    error InvalidAmount();
    
    event TokenDeployed(
        address _beneficiary,
        address _token,
        uint256 _initialSupply
    );
    event TokenMinted(address _subject, address _token, uint256 _amount);

    function tokens(address _subject) external returns (address token_);

    function create(
        address _beneficiary,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _moxiePassVerifier
    ) external returns (address token_);

    function mint(
        address _subject,
        address _beneficiary,
        uint256 _amount
    ) external returns (bool);
}

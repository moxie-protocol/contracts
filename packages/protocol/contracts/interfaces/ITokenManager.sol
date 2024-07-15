// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface ITokenManager {
    error TokenManager_InvalidSubjectImplementation();
    error TokenManager_SubjectExists();
    error TokenManager_InvalidSubject();
    error TokenManager_TokenNotFound();
    error TokenManager_InvalidOwner();
    error TokenManager_InvalidAmount();
    error TokenManager_InvalidAddress();
    error TokenManager_AddressAlreadyAdded();
    error TokenManager_AddressAlreadyRemoved();

    event TokenDeployed(
        address _beneficiary,
        address _token,
        uint256 _initialSupply
    );
    event TokenMinted(address _subject, address _token, uint256 _amount);
    
    event TransferAllowListWalletAllowed(address _wallet, bool allowed);

    function tokens(address _subject) view external returns (address token_);

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


    function addToAllowList(address _wallet) external;
    function removeFromAllowList(address _wallet) external;
    function isWalletAllowed(address _wallet) external returns(bool);

}

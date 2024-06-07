// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./interfaces/IMoxiePassVerifier.sol";
import "./interfaces/ISubjectErc20.sol";

contract SubjectERC20 is
    ISubjectErc20,
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ERC20PermitUpgradeable
{
    IMoxiePassVerifier public moxiePassVerifier;

    error SubjectERC20_NotAMoxiePassHolder();
    error SubjectERC20_InvalidOwner();

    /**
     * @notice Initialize contract
     * @param _owner Owner of contract,
     * @param _name Name of erc20.
     * @param _symbol Symbol of erc20.
     * @param _initialSupply Initial supply used to mint on initialization.
     * @param _moxiePassVerifier Address of moxie pass verifier.
     */
    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _moxiePassVerifier
    ) public initializer {
        if (_owner == address(0)) revert SubjectERC20_InvalidOwner();

        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();
        __Ownable_init(_owner);
        __ERC20Permit_init(_name);

        moxiePassVerifier = IMoxiePassVerifier(_moxiePassVerifier);
        _mint(_owner, _initialSupply);
    }

    /**
     * @notice Mint tokens to address.
     * @param _to Address of beneficiary.
     * @param _amount Amount of tokens to be minted.
     */
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        if (to != address(0) && !moxiePassVerifier.isMoxiePassHolder(to))
            revert SubjectERC20_NotAMoxiePassHolder();

        super._update(from, to, value);
    }
}

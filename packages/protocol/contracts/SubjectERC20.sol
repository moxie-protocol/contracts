// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IMoxiePassVerifier} from "./interfaces/IMoxiePassVerifier.sol";
import {ISubjectErc20} from "./interfaces/ISubjectErc20.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";

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
    error SubjectERC20_InvalidTransfer();

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
     * @notice Verifiers if address is moxie pass holder.
     * @param _address input address.
     */
    modifier onlyMoxiePassHolder(address _address) {
        if (
            _address != address(0) &&
            !moxiePassVerifier.isMoxiePassHolder(_address)
        ) revert SubjectERC20_NotAMoxiePassHolder();
        _;
    }

    /**
     * @notice Verify if transfer is valid based on allowlist.
     * @param _from  From address of transfer.
     * @param _to To address of transfer.
     */
    modifier onlyValidTransfers(address _from, address _to) {
        if (
            _from != address(0) &&
            _to != address(0) &&
            !_isValidTransfer(_from, _to)
        ) {
            revert SubjectERC20_InvalidTransfer();
        }
        _;
    }

    /**
     * @notice Mint tokens to address.
     * @param _to Address of beneficiary.
     * @param _amount Amount of tokens to be minted.
     */
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    /**
     * Only allow to & from whitelisted addresses.
     * @param from From address of transfer.
     * @param to To address of transfer.
     */
    function _isValidTransfer(
        address from,
        address to
    ) internal returns (bool) {
        return
            ITokenManager(owner()).isWalletAllowed(from) ||
            ITokenManager(owner()).isWalletAllowed(to);
    }

    /**
     * @notice This function enforces
     *  1. Only moxie pass holders can own Subject Tokens
     *  2. Transfer of subject token between wallets are not allowed(except done from protocol contracts)
     * @param from Address of from wallet.
     * @param to Address of to wallet.
     * @param value Amount of tokens.
     */
    function _update(
        address from,
        address to,
        uint256 value
    )
        internal
        virtual
        override
        onlyMoxiePassHolder(to)
        onlyValidTransfers(from, to)
    {
        super._update(from, to, value);
    }
}

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
    IMoxiePassVerifier moxiePassVerifier;

    error NotAMoxiePassHolder();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        address _moxiePassVerifier
    ) public initializer {
        __ERC20_init(name, symbol);
        __ERC20Burnable_init();
        __Ownable_init(initialOwner);
        __ERC20Permit_init(name);

        moxiePassVerifier = IMoxiePassVerifier(_moxiePassVerifier);
        _mint(initialOwner, _initialSupply);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        if (!moxiePassVerifier.isMoxiePassHolder(to))
            revert NotAMoxiePassHolder();

        super._update(from, to, value);
    }
}

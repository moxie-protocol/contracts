// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {SecurityModule} from "./SecurityModule.sol";
import {IVault} from "./interfaces/IVault.sol";

contract Vault is SecurityModule, IVault {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    bytes32 public constant DEPOSIT_ROLE = keccak256("DEPOSIT_ROLE");

    // subjectToken =>  moxie => amount
    mapping(address subjectToken => mapping(address moxie => uint256 amount)) public reserves;

    /**
     * @dev Intialize contract.
     * @param _owner Owner of contract.
     */
    function initialize(address _owner) public initializer {

        if(_owner == address(0)) revert InvalidOwner();

        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    /**
     * @dev Returns reserve balance of subject token.
     * @param _subjectToken Subject token for which reserve is tracked.
     * @param _token Token in which reserve is kept. 
     */
    function balanceOf(
        address _subjectToken,
        address _token
    ) external view returns (uint256 balance_) {
        balance_ = reserves[_subjectToken][_token];
    }

    /**
     * @dev Deposit funds to reserve for a subject in a given token. Vault should be approved to spend.
     * @param _subjectToken Subject token for which reserve is tracked.
     * @param _token Token in which reserve is kept.
     * @param _value Amount to deposit. 
     */
    function deposit(
        address _subjectToken,
        address _token,
        uint256 _value
    ) external override onlyRole(DEPOSIT_ROLE) {
        if (_subjectToken == address(0)) revert InvalidSubjectToken();
        if (_token == address(0)) revert InvalidToken();
        if (_value == 0) revert InvalidAmount();
        reserves[_subjectToken][_token] += _value;
        
        emit VaultDeposit(_subjectToken, _token, msg.sender, _value, reserves[_subjectToken][_token]);

        IERC20Extended(_token).safeTransferFrom(
            msg.sender,
            address(this),
            _value
        );
        
    }

    /**
     * @dev Transfer funds from vault. 
     * @param _subjectToken Subject token for which reserve is tracked.
     * @param _token Address of deposit token of reserve. 
     * @param _to To address of beneficiary. 
     * @param _value Amount to transfer. 
     */
    function transfer(
        address _subjectToken,
        address _token,
        address _to,
        uint256 _value
    ) external override whenNotPaused onlyRole(TRANSFER_ROLE) {
        if (_subjectToken == address(0)) revert InvalidSubjectToken();

        if (_token == address(0)) revert InvalidToken();

        if (_to == address(0)) revert InvalidToAddress();

        if (_value == 0) revert InvalidAmount();

        uint256 balance = reserves[_subjectToken][_token];

        if (balance < _value) revert InvalidReserveBalance();

        reserves[_subjectToken][_token] -= _value;
        emit VaultTransfer(_subjectToken, _token, _to, _value, reserves[_subjectToken][_token]);
        
        IERC20Extended(_token).safeTransfer(_to, _value);

    }
}

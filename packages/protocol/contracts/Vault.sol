// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IERC20Extended.sol";
import "./SecurityModule.sol";
import "./interfaces/IVault.sol";

contract Vault is SecurityModule, IVault {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");

    string private ERROR_INVALID_SUBJECT = "INVALID_SUBJECT";
    string private ERROR_INVALID_TOKEN = "INVALID_TOKEN";
    string private ERROR_INVALID_AMOUNT = "INVALID_AMOUNT";
    string private ERROR_INVALID_TO = "INVALID_TO";
    string private ERROR_INVALID_RESERVE_BALANCE = "INVALID_RESERVE_BALANCE";

    mapping(address => mapping(address => uint256)) public reserves;

    function initialize(address _owner) public initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    function balanceOf(
        address _subject,
        address _token
    ) external view returns (uint256 balance_) {
        balance_ = reserves[_subject][_token];
    }

    function deposit(
        address _subject,
        address _token,
        uint256 _value
    ) external override {
        require(_subject != address(0), ERROR_INVALID_SUBJECT);
        require(_token != address(0), ERROR_INVALID_TOKEN);
        require(_value > 0, ERROR_INVALID_AMOUNT);

        IERC20Extended(_token).safeTransferFrom(
            msg.sender,
            address(this),
            _value
        );

        reserves[_subject][_token] += _value;

        emit VaultDeposit(_subject, _token, msg.sender, _value);
    }

    function transfer(
        address _subject,
        address _token,
        address _to,
        uint256 _value
    ) external override onlyRole(TRANSFER_ROLE) {
        require(_subject != address(0), ERROR_INVALID_SUBJECT);
        require(_token != address(0), ERROR_INVALID_TOKEN);
        require(_to != address(0), ERROR_INVALID_TO);
        require(_value > 0, ERROR_INVALID_AMOUNT);

        uint256 balance = reserves[_subject][_token];

        require(balance > _value, ERROR_INVALID_RESERVE_BALANCE);
        reserves[_subject][_token] -= _value;
        IERC20Extended(_token).safeTransfer(_to, _value);

        emit VaultTransfer(_subject, _token, _to, _value);
    }
}

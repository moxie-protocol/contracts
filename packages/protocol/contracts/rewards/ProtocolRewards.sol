// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IERC20Extended} from "../interfaces/IERC20Extended.sol";

import {SecurityModule} from "../SecurityModule.sol";
import {IProtocolRewards} from "./IProtocolRewards.sol";

contract ProtocolRewards is
    IProtocolRewards,
    SecurityModule,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20Extended;

    bytes32 public constant WITHDRAW_TYPEHASH =
        keccak256(
            "Withdraw(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"
        );

    bytes32 public constant BLOCK_UNBLOCK_ROLE =
        keccak256("BLOCK_UNBLOCK_ROLE");

    IERC20Extended public token;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public blockList;

    modifier IfNonBlocked(address _address) {
        if (_address != address(0) && blockList[_address] == true)
            revert PROTOCOL_REWARDS_BLOCKED();
        _;
    }

    /**
     *
     * @param _token Reward token address.
     */
    function initialize(address _token, address _owner) external initializer {
        __Pausable_init();
        __EIP712_init("ProtocolRewards", "1");

        if (_token == address(0)) {
            revert PROTOCOL_REWARDS_ADDRESS_ZERO();
        }

        if (_owner == address(0)) {
            revert PROTOCOL_REWARDS_ADDRESS_ZERO();
        }

        token = IERC20Extended(_token);

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    function totalSupply() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * Deposit rewards for  an address.
     * @param _to Address of reward beneficiary
     * @param _amount  Total amount to deposit
     * @param _reason reason of deposit, example value bytes4(keccak256("PROTOCOL_FEE"));     // 0x8e1a55d1
     * @param _comment Comment
     */
    function deposit(
        address _to,
        uint256 _amount,
        bytes4 _reason,
        string calldata _comment
    ) external {
        if (_to == address(0)) {
            revert PROTOCOL_REWARDS_ADDRESS_ZERO();
        }

        token.transferFrom(msg.sender, address(this), _amount);

        balanceOf[_to] += _amount;

        emit Deposit(msg.sender, _to, _reason, _amount, _comment);
    }

    /**
     * Batch deposit rewards for addresses.
     * @param recipients Array of beneficiary addresses.
     * @param amounts Array of amount.
     * @param reasons Reason of deposit.
     * @param comment Comment on deposit.
     */
    function depositBatch(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes4[] calldata reasons,
        string calldata comment
    ) external {
        uint256 numRecipients = recipients.length;

        if (
            numRecipients != amounts.length || numRecipients != reasons.length
        ) {
            revert PROTOCOL_REWARDS_ARRAY_LENGTH_MISMATCH();
        }

        uint256 expectedTotalValue;

        for (uint256 i; i < numRecipients; i++) {
            expectedTotalValue += amounts[i];
        }

        token.transferFrom(msg.sender, address(this), expectedTotalValue);

        address currentRecipient;
        uint256 currentAmount;

        for (uint256 i; i < numRecipients; i++) {
            currentRecipient = recipients[i];
            currentAmount = amounts[i];

            if (currentRecipient == address(0)) {
                revert PROTOCOL_REWARDS_ADDRESS_ZERO();
            }

            balanceOf[currentRecipient] += currentAmount;

            emit Deposit(
                msg.sender,
                currentRecipient,
                reasons[i],
                currentAmount,
                comment
            );
        }
    }

    /**
     * Withdraw rewards of a wallet.
     * @param to Address where rewards will be transferred.
     * @param amount Total amount, if zero withdraw everything.
     */
    function withdraw(
        address to,
        uint256 amount
    ) external whenNotPaused IfNonBlocked(msg.sender) {
        if (to == address(0)) {
            revert PROTOCOL_REWARDS_ADDRESS_ZERO();
        }

        address owner = msg.sender;

        if (amount > balanceOf[owner]) {
            revert PROTOCOL_REWARDS_INVALID_WITHDRAW();
        }

        if (amount == 0) {
            amount = balanceOf[owner];
        }

        balanceOf[owner] -= amount;

        emit Withdraw(owner, to, amount);

        token.transfer(to, amount);
    }

    /**
     * Withdraw rewards using signature
     * @param from Withdraw from this address.
     * @param to Address where rewards will be transferred.
     * @param amount Total amount, if zero withdraw everything.
     * @param deadline Deadline for the signature to be valid
     * @param v V component of signature
     * @param r R component of signature
     * @param s S component of signature
     */
    function withdrawWithSig(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused IfNonBlocked(from) {
        if (block.timestamp > deadline) {
            revert PROTOCOL_REWARDS_SIGNATURE_DEADLINE_EXPIRED();
        }

        bytes32 withdrawHash;

        unchecked {
            withdrawHash = keccak256(
                abi.encode(
                    WITHDRAW_TYPEHASH,
                    from,
                    to,
                    amount,
                    nonces[from]++,
                    deadline
                )
            );
        }

        bytes32 digest = _hashTypedDataV4(withdrawHash);

        address recoveredAddress = ecrecover(digest, v, r, s);

        if (recoveredAddress == address(0) || recoveredAddress != from) {
            revert PROTOCOL_REWARDS_INVALID_SIGNATURE();
        }

        if (to == address(0)) {
            revert PROTOCOL_REWARDS_ADDRESS_ZERO();
        }

        if (amount > balanceOf[from]) {
            revert PROTOCOL_REWARDS_INVALID_WITHDRAW();
        }

        if (amount == 0) {
            amount = balanceOf[from];
        }

        balanceOf[from] -= amount;

        emit Withdraw(from, to, amount);

        token.transfer(to, amount);
    }

    /**
     * @notice Adds an address to blocklist
     * @param _wallet Wallet address that is to be added to block list.
     */
    function addToBlockList(
        address _wallet
    ) external onlyRole(BLOCK_UNBLOCK_ROLE) {
        if (_wallet == address(0)) revert PROTOCOL_REWARDS_ADDRESS_ZERO();

        blockList[_wallet] = true;

        emit BlockListUpdated(_wallet, true);
    }

    /**
     * @notice Removes an address from block list.
     * @param _wallet Wallet address that is to be removed from allow list.
     */
    function removeFromBLockList(
        address _wallet
    ) external onlyRole(BLOCK_UNBLOCK_ROLE) {
        if (_wallet == address(0)) revert PROTOCOL_REWARDS_ADDRESS_ZERO();

        blockList[_wallet] = false;

        emit BlockListUpdated(_wallet, false);
    }
}

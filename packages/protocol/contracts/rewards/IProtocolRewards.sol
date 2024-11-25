// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.24;

interface IProtocolRewards {

    error ADDRESS_ZERO();
    error INVALID_DEPOSIT();
    error ARRAY_LENGTH_MISMATCH();
    error INVALID_WITHDRAW();
    error SIGNATURE_DEADLINE_EXPIRED();
    error INVALID_SIGNATURE();
    error BLOCKED();

    event Deposit(
        address indexed _from,
        address indexed _to,
        bytes4 indexed _reason,
        uint256 _amount,
        string _comment
    );

    event Withdraw(address indexed _from, address indexed _to, uint256 _amount);


    event BlockListUpdated(address _wallet, bool _isAdded);

    function deposit(address _to, uint256 _amount, bytes4 _why, string calldata _comment) external;

    function depositBatch(
        address[] calldata _recipients,
        uint256[] calldata _amounts,
        bytes4[] calldata _reasons,
        string calldata _comment
    ) external;

    function withdraw(address _to, uint256 _amount) external;

    function withdrawWithSig(
        address _from,
        address _to,
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external;

}

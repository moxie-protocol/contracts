// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IMoxieTokenLockManager {
    // -- Function Call Authorization --

    function setAuthFunctionCall(string calldata _signature, address _target) external;

    function unsetAuthFunctionCall(string calldata _signature) external;

    function setAuthFunctionCallMany(string[] calldata _signatures, address[] calldata _targets) external;

    function getAuthFunctionCallTarget(bytes4 _sigHash) external view returns (address);

    function isAuthFunctionCall(bytes4 _sigHash) external view returns (bool);

    function addSubjectTokenDestination(address _dst) external;

    function getSubjectTokenDestinations() external view returns (address[] memory);

    function addTokenDestination(address _dst) external;

    function getTokenDestinations() external view returns (address[] memory);

    function removeTokenDestination(address _dst) external;

    function removeSubjectTokenDestination(address _dst) external;
}

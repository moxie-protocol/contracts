// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;


interface IMoxieTokenLockManager {
   
    // -- Function Call Authorization --

    function setAuthFunctionCall(string calldata _signature, address _target) external;

    function unsetAuthFunctionCall(string calldata _signature) external;

    function setAuthFunctionCallMany(string[] calldata _signatures, address[] calldata _targets) external;

    function getAuthFunctionCallTarget(bytes4 _sigHash) external view returns (address);

    function isAuthFunctionCall(bytes4 _sigHash) external view returns (bool);

}

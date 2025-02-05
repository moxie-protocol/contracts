// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface IMoxiePassVerifier {

    function isMoxiePassHolder(address _address) external view returns (bool);
}

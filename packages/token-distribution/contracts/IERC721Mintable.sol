// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC721Mintable is IERC721{

    function mint(address to) external;

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {MoxieBondingCurveV3} from "../contracts/MoxieBondingCurveV3.sol";
import {MoxieToken} from "../contracts/tokens/MoxieToken.sol";
import {TokenManager} from "../contracts/TokenManager.sol";
import {IGraduationHook} from "../contracts/interfaces/IGraduationHook.sol";
import {IERC20Extended} from "../contracts/interfaces/IERC20Extended.sol";
import {Vm} from "forge-std/Vm.sol";

contract TestMoxieBondingCurveV3 is Test {
    MoxieBondingCurveV3 moxieBondingCurveV3 =
        MoxieBondingCurveV3(0x56147e70A57012ade3003fe93a394BFC35d747e3);
    MoxieToken moxieToken;
    TokenManager tokenManager;

    address richUser = 0x9b36D8BED0AFB3EE990961786271ED136d798dBe;
    uint256 baseSepoliaFork;

    function setUp() public {
        baseSepoliaFork = vm.createFork(vm.envString("TESTNET_RPC_URL"));
        moxieBondingCurveV3 = MoxieBondingCurveV3(
            0x56147e70A57012ade3003fe93a394BFC35d747e3
        );
        moxieToken = MoxieToken(0x5D7cb10515D07a1726A30AffFFEDBE3cc048C412);
        tokenManager = TokenManager(0xFd990aF1c711cC0fc46E66B22877B028aF7eF59C);
    }

    function test_buySharesOfGraduatedSubject() public {
        vm.selectFork(baseSepoliaFork);
        vm.startPrank(richUser);
        address graduatedSubject = 0x8e2d39591A720467E5324aD8b163D1C69a8C8193;
        moxieToken.approve(address(moxieBondingCurveV3), 1000000000000000000);
        vm.recordLogs();
        moxieBondingCurveV3.buyShares(
            address(graduatedSubject),
            1000000000000000000,
            0
        );
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool swapEventFound = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (
                entries[i].topics[0] ==
                keccak256("Swap(address,address,bool,uint256,uint256)")
            ) {
                swapEventFound = true;
                break;
            }
        }
        require(swapEventFound, "Swap event not found");
        vm.stopPrank();
    }

    function test_buySharesOfGraduatableSubject() public {
        vm.selectFork(baseSepoliaFork);
        vm.startPrank(richUser);
        address graduatableSubject = 0xe5e542948878c23ACB59b82BDf40fE637E31D4D2;
        moxieToken.approve(address(moxieBondingCurveV3), 1000000000000000000);
        vm.recordLogs();
        moxieBondingCurveV3.buyShares(
            address(graduatableSubject),
            1000000000000000000,
            0
        );
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool subjectGraduatedEventFound = false;
        bytes32 subjectGraduatedEvent = 0xb691de8471a2a712fd757e435bb58388e61ea2c7ea84357984cdccbd76ca14fd;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == subjectGraduatedEvent) {
                subjectGraduatedEventFound = true;
                break;
            }
        }
        require(
            subjectGraduatedEventFound,
            "Subject graduated event not found"
        );
        vm.stopPrank();
    }

    function test_buySharesOfSubjectNotReadyForGraduation() public {
        vm.selectFork(baseSepoliaFork);
        vm.startPrank(richUser);
        address subjectNotReadyForGraduation = 0x7bA63D9A8D63Ae9125CCe01B499D24542387C149;
        moxieToken.approve(address(moxieBondingCurveV3), 1000000000000000000);
        vm.recordLogs();
        moxieBondingCurveV3.buyShares(
            address(subjectNotReadyForGraduation),
            1000000000000000000,
            0
        );
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool swapEventFound = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (
                entries[i].topics[0] ==
                keccak256("Swap(address,address,bool,uint256,uint256)")
            ) {
                swapEventFound = true;
                break;
            }
        }
        require(!swapEventFound, "Swap event found");
        vm.stopPrank();
    }
}

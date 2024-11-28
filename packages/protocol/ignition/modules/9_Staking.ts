
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";
import config from "../config/config.json";
import MoxiePass from "./1_MoxiePass";

import Permissiongs from "./6_Permissions";
export default buildModule("Staking", (m) => {
    
    const proxyAdminOwner = config.proxyAdminOwner;


    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const minter = m.getAccount(2);

    const { moxieToken } = m.useModule(MoxieToken);
    const { moxiePass } = m.useModule(MoxiePass);
    const { } = m.useModule(Permissiongs)
    const {  tokenManagerInstance, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);

    
    const staking = m.contract("Staking", [], { from: deployer });

    m.call(staking, "initialize", [tokenManagerInstance, moxieBondingCurveInstance, moxieToken, owner], { from: deployer, id: "initializeStakingMasterCopy" });

    const stakingCallData = m.encodeFunctionCall(staking, "initialize", [tokenManagerInstance, moxieBondingCurveInstance, moxieToken, owner]);

    // deploy staking proxy
    const stakingProxy = m.contract("TransparentUpgradeableProxy", [
        staking,
        proxyAdminOwner,
        stakingCallData,
    ], {
        id: "stakingProxy",
        from: deployer
    });

    const stakingInstance = m.contractAt('Staking', stakingProxy, { id: 'stakingInstance' });

    // mint moxie pass for staking contract
    m.call(moxiePass, "mint", [stakingInstance, config.moxiePassURL], { from: minter, id: 'stakingMoxiePass' });
    
    // add staking contract to transfer allow list
    m.call(tokenManagerInstance, "addToTransferAllowList", [stakingInstance], { from: owner, id: "stakingInAllowList" })

    const changeLockDurationRole = m.staticCall(stakingInstance, "CHANGE_LOCK_DURATION");

   const assignChangeDurationRole = m.call(stakingInstance, 'grantRole', [changeLockDurationRole, owner], { from: owner, id: 'changeLockDurationRoleToOwner', after: [stakingProxy] });

    m.call(stakingInstance, 'setLockPeriod', [config.stakingLockDurationInSec, true], { from: owner, id: 'setLockPeriodTo3Months', after: [assignChangeDurationRole] });

    return { staking, stakingInstance };
});
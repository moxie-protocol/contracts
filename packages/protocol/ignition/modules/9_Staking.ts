
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";
import config from "../config/config.json";
import MoxiePass from "./1_MoxiePass";


const addresses = {
    "TokenManager": "0xFd990aF1c711cC0fc46E66B22877B028aF7eF59C",
    "MoxieBondingCurve": "0x56147e70A57012ade3003fe93a394BFC35d747e3",
    "MoxieToken": "0x5D7cb10515D07a1726A30AffFFEDBE3cc048C412",
    "MoxieTokenHolder": "0x9313eDE439fC91852D4Fd8f753C5569255286790",
    "MoxiePass": "0xbeb4dD56f26Da61594dfCf7132A5c6008456Fb35",
    "MoxiePassMinterAddress": "0xd998E2B16d7D0AbF528Bc82519E4144cBcAD2612",
    "SubjectTokenHolder": "0x8EB6A9275637358Fea56D8431e85B6BB6F260853",
    "SubjectToken": "0x397ECB38499731e3E2Bbc03997682Fd713eE5c4E",
    "Subject": "0x485c6aB93F276260fb9718Df921d46854Fe62962",
    "AlreadyBoughtVesting": "0x78B0208291d8457EBDB58D34BdEdaEf7b428f7ae",
    "AlreadyBoughtVestingBeneficiary": "0x8e2d39591a720467e5324ad8b163d1c69a8c8193",
    "AlreadyBoughtVestingManager": "0x31391fd2fa4c4ab7c4770c78ea7641f5dadf4bb3",
    "AlreadyBoughtVestingManagerOwner": "0x9313eDE439fC91852D4Fd8f753C5569255286790",
    "AlreadyBoughtSubjectToken": "0xFf5b8938951092FaEf338F5015B84a9a57452548",
    "AlreadyBoughtSubject": "0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82"
}

export default buildModule("Staking", (m) => {

    const proxyAdminOwner = config.proxyAdminOwner;


    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const minter = m.getAccount(2);

    const moxieToken = m.contractAt("MoxieToken", addresses.MoxieToken);
    const moxiePass = m.contractAt("MoxiePass", addresses.MoxiePass);
    const tokenManagerInstance = m.contractAt("TokenManager", addresses.TokenManager);
    const moxieBondingCurveInstance = m.contractAt("MoxieBondingCurve", addresses.MoxieBondingCurve);
    // const { tokenManagerInstance, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);


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
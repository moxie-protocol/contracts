
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";
import ProtocolContracts from "./4_ProtocolContracts";
import ProtocolRewards from "./10_ProtocolRewards";
import config from "../config/config.json";
import EasyAuction from "./3_EasyAuction";
import Permissions from "./6_Permissions";


const protocolBuyFeePct = config.protocolBuyFeePctForBC;
const protocolSellFeePct = config.protocolSellFeePctForBC;
const subjectBuyFeePct = config.subjectBuyFeePctForBC;
const subjectSellFeePct = config.subjectSellFeePctForBC;

const feeInputBondingCurve = {
  protocolBuyFeePct,
  protocolSellFeePct,
  subjectBuyFeePct,
  subjectSellFeePct,
};
const feeBeneficiary = config.feeBeneficiary;

const feeInputSubjectFactory = {
  protocolFeePct: config.protocolFeePctForSF,
  subjectFeePct: config.subjectFeePctForSF
};
const AUCTION_DURATION = config.auctionDuration;
const AUCTION_ORDER_CANCELLATION_DURATION = config.auctionOrderCancellationDuration;


export default buildModule("UpgradeProtocol", (m) => {

  const { easyAuction } = m.useModule(EasyAuction);
  const deployer = m.getAccount(0);
  const owner = m.getAccount(1);
  const proxyAdminOwnerAccount = m.getAccount(8);
  const { moxieToken } = m.useModule(MoxieToken);
  const { formula, tokenManager, vault } = m.useModule(ProtocolContracts);
  const { protocolRewards } = m.useModule(ProtocolRewards);
  // const protocolRewards = m.contract("ProtocolRewards", [], { from: deployer });
  const moxieBondingCurveV2 = m.contract("MoxieBondingCurveV2", [], { from: deployer, id: "moxieBondingCurveV2" })
  const subjectFactoryV2 = m.contract("SubjectFactoryV2", [], { from: deployer, id: "subjectFactoryV2" });

  m.call(moxieBondingCurveV2, "initialize", [
    moxieToken,
    formula,
    owner,
    tokenManager,
    vault,
    feeInputBondingCurve,
    feeBeneficiary,
    subjectFactoryV2
  ], { id: "initializeMoxieBondingCurveV2MasterCopy" })


  m.call(subjectFactoryV2, "initialize", [
    owner,
    tokenManager,
    moxieBondingCurveV2,
    moxieToken,
    easyAuction,
    feeInputSubjectFactory,
    feeBeneficiary,
    AUCTION_DURATION,
    AUCTION_ORDER_CANCELLATION_DURATION
  ], { id: "initializeSubjectFactoryV2MasterCopy" });

  const { moxieBondingCurveProxyAdmin, moxieBondingCurveInstance, subjectFactoryInstance, subjectFactoryProxyAdmin } = m.useModule(ProtocolContractsProxy);

   m.call(moxieBondingCurveProxyAdmin, "upgradeAndCall", [moxieBondingCurveInstance, moxieBondingCurveV2, '0x'], {
    from: proxyAdminOwnerAccount,
    id: "moxieBondingCurveV2Upgrade"
  });

  m.call(subjectFactoryProxyAdmin, "upgradeAndCall", [subjectFactoryInstance, subjectFactoryV2, '0x'], {
    from: proxyAdminOwnerAccount,
    id: "subjectFactoryV2Upgrade"
  });

  // // set UPDATE_PROTOCOL_REWARD_ROLE role
  // const updateProtocolRewardRole = m.staticCall(moxieBondingCurveInstance, "UPDATE_PROTOCOL_REWARD_ROLE");
  // const updateFeesRole = m.staticCall(moxieBondingCurveInstance, "UPDATE_FEES_ROLE");
  // // TODO: verify who should be the beneficiary
  // const grantUpdateProtocolRewardRole = m.call(moxieBondingCurveInstance, 'grantRole', [updateProtocolRewardRole, config.adminRoleBeneficiary,], { from: owner, id: "moxieBondingCurveUpdateProtocolRewardRole" });
  // const grantUpdateFeesRole = m.call(moxieBondingCurveInstance, 'grantRole', [updateFeesRole, config.adminRoleBeneficiary,], { from: owner, id: "moxieBondingCurveUpdateFeesRole" });
  // // set the protocol rewARD contract 
  // m.call(moxieBondingCurveV2, "updateProtocolRewardAddress", [protocolRewards], { from: config.adminRoleBeneficiary, id: "updateProtocolRewardAddress", after: [grantUpdateProtocolRewardRole, grantUpdateFeesRole] });
  // // set the platform & order referral fee  // platfrom 20% order: 25%
  // m.call(moxieBondingCurveV2, "updateReferralFee", [config.platformReferrerBuyFeePct, config.platformReferrerSellFeePct, config.orderReferrerBuyFeePct, config.orderReferrerSellFeePct], { from: config.adminRoleBeneficiary, id: "updateReferralFee", after: [grantUpdateProtocolRewardRole, grantUpdateFeesRole] });

  return { moxieBondingCurveV2, subjectFactoryV2 };
});
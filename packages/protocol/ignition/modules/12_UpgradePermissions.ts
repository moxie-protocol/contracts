
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";
import ProtocolContracts from "./4_ProtocolContracts";
import ProtocolRewards from "./10_ProtocolRewards";
import config from "../config/config.json";
import EasyAuction from "./3_EasyAuction";
import Permissions from "./6_Permissions";
import UpgradeProtocol from "./11_UpgradeProtocol"

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


export default buildModule("UpgradePermissions", (m) => {

  const owner = m.getAccount(1);
  const { moxieBondingCurveV2, subjectFactoryV2 } = m.useModule(UpgradeProtocol)
  const { protocolRewardInstance } = m.useModule(ProtocolRewards);

  // set UPDATE_PROTOCOL_REWARD_ROLE role
  const updateProtocolRewardRole = m.staticCall(moxieBondingCurveV2, "UPDATE_PROTOCOL_REWARD_ROLE");
  const updateFeesRole = m.staticCall(moxieBondingCurveV2, "UPDATE_FEES_ROLE");
  // TODO: verify who should be the beneficiary
  const grantUpdateProtocolRewardRole = m.call(moxieBondingCurveV2, 'grantRole',
    [updateProtocolRewardRole, owner],
    { from: owner, id: "moxieBondingCurveV2UpdateProtocolRewardRole" }
  );
  const grantUpdateFeesRole = m.call(moxieBondingCurveV2, 'grantRole',
    [updateFeesRole, owner],
    { from: owner, id: "moxieBondingCurveV2UpdateFeesRole" }
  );
  // set the protocol rewARD contract 
  m.call(moxieBondingCurveV2, "updateProtocolRewardAddress",
    [protocolRewardInstance],
    {
      from: owner,
      id: "moxieBondingCurveV2updateProtocolRewardAddress",
      after: [grantUpdateProtocolRewardRole, grantUpdateFeesRole]
    });
  // set the platform & order referral fee  // platfrom 20% order: 25%
  m.call(moxieBondingCurveV2, "updateReferralFee",
    [config.platformReferrerBuyFeePct, config.platformReferrerSellFeePct, config.orderReferrerBuyFeePct, config.orderReferrerSellFeePct],
    {
      from: owner, id: "moxieBondingCurveV2UpdateReferralFee",
      after: [grantUpdateProtocolRewardRole, grantUpdateFeesRole]
    });


    // Update protocol rewards in subject factory & set platform referrer fee

  const updateProtocolRewardRoleSubjectFactory = m.staticCall(subjectFactoryV2, "UPDATE_PROTOCOL_REWARD_ROLE");
  const updateFeesRoleSubjectFactory = m.staticCall(subjectFactoryV2, "UPDATE_FEES_ROLE");


  const grantUpdateProtocolRewardRoleSubjectFactory = m.call(subjectFactoryV2, 'grantRole',
    [updateProtocolRewardRoleSubjectFactory, owner],
    { from: owner, id: "subjectFactoryV2UpdateProtocolRewardRole" }
  );
  
  const grantUpdateFeesRoleSubjectFactory = m.call(subjectFactoryV2, 'grantRole',
    [updateFeesRoleSubjectFactory, owner],
    { from: owner, id: "subjectFactoryV2UpdateFeesRole" }
  );

  m.call(subjectFactoryV2, "updateProtocolRewardAddress",
    [protocolRewardInstance],
    {
      from: owner,
      id: "subjectFactoryV2updateProtocolRewardAddress",
      after: [grantUpdateProtocolRewardRoleSubjectFactory, grantUpdateFeesRoleSubjectFactory]
    });

    m.call(subjectFactoryV2, "updatePlatformReferrerFee",
      [config.platformReferrerFeePct],
      {
        from: owner,
        id: "subjectFactoryV2UpdateProtocolReferrer",
        after: [grantUpdateProtocolRewardRoleSubjectFactory, grantUpdateFeesRoleSubjectFactory]
      });

  return { moxieBondingCurveV2, subjectFactoryV2 };
});
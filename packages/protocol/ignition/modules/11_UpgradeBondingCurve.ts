
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";

import config from "../config/config.json";


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

export default buildModule("UpgradeBondingCurve", (m) => {
    
    const proxyAdminOwner = config.proxyAdminOwner;

    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const proxyAdminOwnerAccount = m.getAccount(9);

    const { moxieToken } = m.useModule(MoxieToken);
    const protocolRewards = m.contract("ProtocolRewards", [], { from: deployer });

    const moxieBondingCurveV2 = m.contract("MoxieBondingCurve", [], { from: deployer, id: "moxieBondingCurveV2" })

    const subjectFactory = m.contract("SubjectFactory", [], { from: deployer });
    const formula = m.contract("BancorFormula", [], { from: deployer });
    const vault = m.contract("Vault", [], { from: deployer });
    const tokenManager = m.contract("TokenManager", [], { from: deployer })

    m.call(moxieBondingCurveV2, "initialize", [
        moxieToken,
        formula,
        owner,
        tokenManager,
        vault,
        feeInputBondingCurve,
        feeBeneficiary,
        subjectFactory
      ], { id: "initializeMoxieBondingCurveV2MasterCopy" })
    
      const { moxieBondingCurveProxyAdmin, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);

      m.call(moxieBondingCurveProxyAdmin, "upgradeAndCall",[moxieBondingCurveInstance, moxieBondingCurveV2, '0x'], {
        from: proxyAdminOwnerAccount,
        id: "moxieBondingCurveV2Upgrade"
      });


      // set the protocol rewARD contract 

      // set the platform & order referral fee  // platfrom 20% order: 25%


    return {moxieBondingCurveV2};
});
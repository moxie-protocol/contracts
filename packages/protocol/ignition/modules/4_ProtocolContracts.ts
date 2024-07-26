import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxiePass from "./1_MoxiePass";
import MoxieToken from "./2_MoxieToken";
import config from "../config/config.json";
import EasyAuction from "./3_EasyAuction";


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

const feeInputSubjectFactory = {
  protocolFeePct: config.protocolFeePctForSF,
  subjectFeePct: config.subjectFeePctForSF
};

const AUCTION_DURATION = config.auctionDuration;
const AUCTION_ORDER_CANCELLATION_DURATION = config.auctionOrderCancellationDuration;


export default buildModule("ProtocolContracts", (m) => {

  const deployer = m.getAccount(0);
  const owner = m.getAccount(1);

  const { moxiePass } = m.useModule(MoxiePass);
  const { moxieToken } = m.useModule(MoxieToken);
  const {easyAuction} = m.useModule(EasyAuction);

  const subjectFactory = m.contract("SubjectFactory", [], { from: deployer });
  const formula = m.contract("BancorFormula", [], { from: deployer });
  const vault = m.contract("Vault", [], { from: deployer });
  const subjectERC20 = m.contract("SubjectERC20", [], { from: deployer })
  const moxiePassVerifier = m.contract("MoxiePassVerifier", [owner], { from: deployer })
  const tokenManager = m.contract("TokenManager", [], { from: deployer })
  const moxieBondingCurve = m.contract("MoxieBondingCurve", [], { from: deployer })


  m.call(vault, "initialize", [owner], { id: "initializeVaultMasterCopy" });
  m.call(tokenManager, "initialize", [owner, subjectERC20], { id: "initializeTokenManagerMasterCopy" });

  const feeBeneficiary = config.feeBeneficiary;

  m.call(moxieBondingCurve, "initialize", [
    moxieToken,
    formula,
    owner,
    tokenManager,
    vault,
    feeInputBondingCurve,
    feeBeneficiary,
    subjectFactory
  ], { id: "initializeMoxieBondingCurveMasterCopy" })


  m.call(subjectFactory, "initialize", [
    owner,
    tokenManager,
    moxieBondingCurve,
    moxieToken,
    easyAuction,
    feeInputSubjectFactory,
    feeBeneficiary,
    AUCTION_DURATION,
    AUCTION_ORDER_CANCELLATION_DURATION
  ],{ id: "initializeSubjectFactoryMasterCopy" });

  return { subjectFactory, formula, vault, subjectERC20, moxiePassVerifier, tokenManager, moxieBondingCurve };
});
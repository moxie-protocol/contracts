
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import config from "../config/config.json";

import MoxieToken from "./2_MoxieToken";
import EasyAuction from "./3_EasyAuction";
import protocolContracts  from "./4_ProtocolContracts";

import moxieBondingCurve from "./11_UpgradeBondingCurve";

const feeInputSubjectFactory = {
    protocolFeePct: config.protocolFeePctForSF,
    subjectFeePct: config.subjectFeePctForSF
};
const AUCTION_DURATION = config.auctionDuration;
const AUCTION_ORDER_CANCELLATION_DURATION = config.auctionOrderCancellationDuration;

export default buildModule("UpgradeSubjectFactory", (m) => {
    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const subjectFactory = m.contract("SubjectFactory", [], { from: deployer,id: "subjectFactoryV2" });

    const { tokenManager } = m.useModule(protocolContracts);
    const { moxieBondingCurveV2 } = m.useModule(moxieBondingCurve);
    const { moxieToken } = m.useModule(MoxieToken);
    const { easyAuction } = m.useModule(EasyAuction);

    const feeBeneficiary = config.feeBeneficiary;
    m.call(subjectFactory, "initialize", [
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
    return { subjectFactory };
});
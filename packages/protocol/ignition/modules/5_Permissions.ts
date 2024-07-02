import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContractsProxy from "./4_ProtocolContractsProxy";
import MoxiePass from "./1_MoxiePass";
import ProtocolContracts from "./3_ProtocolContracts";

export default buildModule("Permissions", (m) => {


    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const minter = m.getAccount(2);

    const { moxiePass } = m.useModule(MoxiePass);
    const { easyAuction } = m.useModule(ProtocolContracts);
    const {vaultProxy, tokenManagerProxy, subjectFactoryProxy, moxieBondingCurveProxy } = m.useModule(ProtocolContractsProxy);

    m.call(moxiePass, "mint", [tokenManagerProxy, "url"], { from: minter, id: 'tokenManagerMoxiePass' });
    m.call(moxiePass, "mint", [moxieBondingCurveProxy, "url"], { from: minter, id: 'bondingCurveMoxiePass' });
    m.call(moxiePass, "mint", [subjectFactoryProxy, "url"], { from: minter, id: 'subjectFactoryMoxiePass' });
    m.call(moxiePass, "mint", [easyAuction, "url"], { from: minter, id: 'easyAuctionMoxiePass' });


    m.call(vaultProxy, 'grantRole', [], {from: owner});
    m.call(vaultProxy, 'grantRole', [], {from: owner});
    m.call(vaultProxy, 'grantRole', [], {from: owner});

    m.call(tokenManagerProxy, 'grantRole', [], {from: owner});
    m.call(tokenManagerProxy, 'grantRole', [], {from: owner});


    


    return {}

});
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MoxiePass from "./1_MoxiePass";
import config from "../config/config.json"

export default buildModule("TokenLockManagerPermissions", (m) => {

    const minter = m.getAccount(2);

    const { moxiePass } = m.useModule(MoxiePass);

    m.call(moxiePass, "mint", [config.tokenLockManager, config.moxiePassURL], { from: minter, id: 'tokenLockManagerMoxiePass' });

    return {}

});
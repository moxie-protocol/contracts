import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MoxiePass from "./1_MoxiePass";
import config from "../config/config.json"

export default buildModule("TokenLockManagerPermissions", (m) => {

    const owner = m.getAccount(1);

    const { moxiePass } = m.useModule(MoxiePass);

    const mintRole = m.staticCall(moxiePass, "MINTER_ROLE");

    m.call(moxiePass, "grantRole", [mintRole, config.tokenLockManager,], { from: owner, id: 'tokenLockManagerMintRole' });

    return {}

});
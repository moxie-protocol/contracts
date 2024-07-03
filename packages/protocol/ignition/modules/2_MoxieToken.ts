import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import config from '../config/config.json';

const MOXIE_SUPPLY = '10000000000000000000000000000';
export default buildModule("MoxieToken", (m) => {

  const owner = m.getAccount(1);
  const moxieToken = m.contract("MoxieToken", [], { from: owner });

  
  m.call(moxieToken, "transfer", [config.moxieTokenBeneficiary , MOXIE_SUPPLY], {from:owner})
  return { moxieToken };
});
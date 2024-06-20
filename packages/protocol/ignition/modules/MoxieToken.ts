import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MoxieToken", (m) => {

  const owner = m.getAccount(1);
  const moxieToken = m.contract("MoxieToken", [], { from: owner });

  return { moxieToken };
});
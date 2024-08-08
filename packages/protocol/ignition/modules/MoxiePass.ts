import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import keys from './testnet/key.json'
export default buildModule("MoxiePass", (m) => {


  const deployer = m.getAccount(0);
  const owner = m.getAccount(1);
  const minter = m.getAccount(2);

  const moxiePass = m.contract("MoxiePass", [owner, minter], { from: deployer });

  return { moxiePass };
});
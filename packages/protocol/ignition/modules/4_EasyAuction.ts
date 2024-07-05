import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import EasyAuction from "../../test-artifact/easy-auction/artifacts/EasyAuction.json"

export default buildModule("EasyAuctionContracts", (m) => {

  const owner = m.getAccount(1);

  const easyAuction = m.contract("EasyAuction", EasyAuction, [], { from: owner });

  return { easyAuction };
});
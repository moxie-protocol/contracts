
import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import hre from "hardhat";
import { randomBytes, ZeroAddress, zeroPadBytes } from "ethers";

describe("BancorsV2", function () {


    it('verify fund cost & purchase target amount for larger amount', async () => {

        const BancorFormula =
            await hre.ethers.getContractFactory("BancorFormulaV2");

    
      const bancorFormula  =  await BancorFormula.deploy();

      const amount = "335885501952000"
      const out1= await bancorFormula.fundCost(
        6200000000000,
        3500000000000,
        660000,
        amount
      );

      console.log({out1})



      const out2 = await bancorFormula.purchaseTargetAmount(
        6200000000000,
        3500000000000,
        660000,
        out1
      );

      expect(out2).equal(amount)

    });


    it('verify fund cost & purchase target amount for small amount', async () => {

        const BancorFormula =
            await hre.ethers.getContractFactory("BancorFormulaV2");

    
      const bancorFormula  =  await BancorFormula.deploy();

      const amount = "335885501952000"
      const out1= await bancorFormula.fundCost(
        62,
        35,
        660000,
        amount
      );

      console.log({out1})

      const out2 = await bancorFormula.purchaseTargetAmount(
        62,
        35,
        660000,
        out1
      );
      expect(out2).equal(amount)
    });
});
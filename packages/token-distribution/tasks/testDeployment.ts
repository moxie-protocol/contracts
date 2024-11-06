import { expect } from "chai";
import hre from "hardhat";
import readline from 'readline';
import fs from 'fs';
import { BigNumber} from "@ethersproject/bignumber";

describe('Test Vesting Contract Deloyment', () => {

    const deploy = async (): Promise<{ input_data: string[][], output_data: string[][] }> => {

        // Read input csv file path from command line
        const csvFilePath = "/Users/sarvesh/Documents/Github/contracts/packages/token-distribution/tasks/investor/Investor-vesting-schedule1-deploy.csv";
        if (!csvFilePath) {
            console.error('Please provide input CSV file path');
        }
        const input_data = await readCSV(csvFilePath);

        // Read output csv file path from command line
        const outFilePath = "/Users/sarvesh/Documents/Github/contracts/packages/token-distribution/tasks/investor/Investor-vesting-schedule1-result.csv";
        if (!outFilePath) {
            console.error('Please provide input CSV file path');
        }
        const output_data = await readCSV(outFilePath);

        return { input_data, output_data };

    }

    it('Check that input file only have unique beneficiaries', async () => {
        const {input_data}  = await deploy();

        // check input file should have unique beneficiaries
        const beneficiaries = input_data.slice(1).map((row) => row[0]);
        const uniqueBeneficiaries = [...new Set(beneficiaries)];
        expect(beneficiaries.length).to.be.equal(uniqueBeneficiaries.length);

    });

    it('Check that for every beneficiary in input file we have only 1 vesting contract deployed', async () => {
        const { input_data, output_data } = await deploy();

        // check that for every beneficiary in input file we have only 1 vesting contract deployed in output file
        const beneficiaries = input_data.slice(1).map((row) => row[0]);
        const uniqueBeneficiaries = [...new Set(beneficiaries)];

        // loop over unique beneficiaries and check that for every beneficiary we have only 1 vesting contract deployed
        uniqueBeneficiaries.forEach((beneficiary) => {
            const count = output_data.filter((row) => row[0] === beneficiary).length;
            expect(count).to.be.equal(1);
        });

    });

    it('Check that all transactions happened during deployment are success', async () => {
        const { output_data } = await deploy();

        // Get unique transaction hashes from output file
        const transactionHashes = output_data.map((row) => row[10]);
        const uniqueTransactionHashes = [...new Set(transactionHashes)];

        // Check that all transactions happened during deployment are success
        // Batch processing in chunks of 10 transactions (adjust batch size as needed)
        const batchSize = 5;
        for (let i = 0; i < uniqueTransactionHashes.length; i += batchSize) {
            const batch = uniqueTransactionHashes.slice(i, i + batchSize);
            await Promise.all(batch.map(txHash => checkTransactionStatuses(txHash)));
        }
        console.log("All transactions checked successfully.");

    });

    it('Check that deployed vesting contract has the same configuration as provided', async () => {
        const { input_data, output_data } = await deploy();

        try {
            // Batch processing in chunks of 5 contracts (adjust batch size as needed)
            const batchSize = 5;
            for (let i = 1; i < input_data.length; i += batchSize) {
                const batchInputs = input_data.slice(i, i + batchSize);
                const batchOutputs = batchInputs.map(inputRow => output_data.find(row => row[0] === inputRow[0]));

                await Promise.all(batchOutputs.map(async (outputRow, index) => {
                    if (!outputRow) {
                        throw new Error(`Output row not found for input row with id ${batchInputs[index][0]}`);
                    }

                    const inputRow = batchInputs[index];
                    const vestingContract = await hre.ethers.getContractAt('MoxieTokenLockWallet', outputRow[8]);

                    return Promise.all([
                        vestingContract.beneficiary().then(beneficiary => {
                            expect(beneficiary).to.be.equal(inputRow[0]);
                        }),
                        vestingContract.managedAmount().then(managedAmount => {
                            expect(managedAmount).to.be.equal(BigNumber.from(inputRow[1]).mul(BigNumber.from(10).pow(18)).toString());
                        }),
                        vestingContract.startTime().then(startTime => {
                            expect(startTime).to.be.equal(inputRow[2]);
                        }),
                        vestingContract.endTime().then(endTime => {
                            expect(endTime).to.be.equal(inputRow[3]);
                        }),
                        vestingContract.periods().then(periods => {
                            expect(periods).to.be.equal(inputRow[4]);
                        }),
                        vestingContract.revocable().then(revocable => {
                            expect(revocable).to.be.equal(parseInt(inputRow[5], 10));
                        }),
                        vestingContract.releaseStartTime().then(releaseStartTime => {
                            expect(releaseStartTime).to.be.equal(inputRow[6]);
                        }),
                        vestingContract.vestingCliffTime().then(vestingCliffTime => {
                            expect(vestingCliffTime).to.be.equal(inputRow[7]);
                        })
                    ]);
                }));
            }

            console.log("All vesting contracts checked successfully.");
        } catch (err) {
            console.error(err);
        }
    });

});

async function readCSV(filePath: string) {
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const data: string[][] = [];
    for await (const line of rl) {
        const row = line.split(',');
        data.push(row);
    }

    return data;
}

async function checkTransactionStatuses(txHash: string) {
    const provider = hre.ethers.provider
    const tx = await provider.getTransactionReceipt(txHash);
    expect(tx.status).to.be.equal(1);
}

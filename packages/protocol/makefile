-include .env

.PHONY: deploy install clean

install:
	npm install
	forge install OpenZeppelin/openzeppelin-contracts --no-commit
	forge install foundry-rs/forge-std@v1.8.2 --no-commit
	cd lib && mkdir -p @uniswap && cd @uniswap && git clone https://github.com/Uniswap/briefcase.git

deploy-graduation-testnet:
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(TESTNET_RPC_URL)  --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

deploy-graduation-mainnet:
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(MAINNET_RPC_URL)  --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

upgrade-moxie-bonding-curve-mainnet:
	forge script script/UpgradeMoxieBondingCurve.s.sol:UpgradeMoxieBondingCurve --rpc-url $(MAINNET_RPC_URL)  --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv --broadcast --verify

upgrade-moxie-bonding-curve-testnet:
	forge script script/UpgradeMoxieBondingCurve.s.sol:UpgradeMoxieBondingCurve --rpc-url $(TESTNET_RPC_URL)  --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv --broadcast	 

deploy-dumping-mainnet:
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(MAINNET_RPC_URL) --via-ir -vvvv 

deploy-dumping-testnet:
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(TESTNET_RPC_URL) --via-ir -vvvv  

clean:
	forge clean

verify:
	forge verify-contract --etherscan-api-key $(ETHERSCAN_API_KEY)  0x4a54b8476C0F6F2A4400E51a9d7c5AD815af45ca --rpc-url $(TESTNET_RPC_URL)

verify-mainnet:
	forge verify-contract --etherscan-api-key $(ETHERSCAN_API_KEY)  0x4a54b8476C0F6F2A4400E51a9d7c5AD815af45ca --rpc-url $(MAINNET_RPC_URL)

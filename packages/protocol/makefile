-include .env

.PHONY: deploy install clean

install:
	npm install
	forge install OpenZeppelin/openzeppelin-contracts --no-commit
	forge install foundry-rs/forge-std@v1.8.2 --no-commit
	cd lib && mkdir -p @uniswap && cd @uniswap && git clone https://github.com/Uniswap/briefcase.git

deploy-graduation-testnet:
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(TESTNET_RPC_URL) --via-ir --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

deploy-graduation-mainnet:
	forge script script/DeployGraduation.s.sol:DeployGraduation --rpc-url $(MAINNET_RPC_URL) --via-ir --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

deploy-dumping-mainnet:
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(MAINNET_RPC_URL) --via-ir -vvvv 

deploy-dumping-testnet:
	forge script script/TestDumping.s.sol:TestDumping --rpc-url $(TESTNET_RPC_URL) --via-ir -vvvv  

clean:
	forge clean

verify:
	forge verify-contract --etherscan-api-key $(ETHERSCAN_API_KEY)  0x6CA6dcd175C81CF0E6f68552aD444a9685da72b9 --rpc-url $(TESTNET_RPC_URL) --via-ir
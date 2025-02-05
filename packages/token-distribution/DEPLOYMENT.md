
# Vesting Contract Deployment steps:

-- configure MoxiePassToken Address, Moxie Token Address and MoxiePass Token URL in config.json file

-- deploy TokenLockManager contract
yarn hardhat deploy --tags manager --network base-sepolia

-- verify TokenLockManager contract
yarn hardhat verify <<TokenLockManager address>> <<MOXIE Token>>  <<TokenLockWallet Master copy>> --network base-sepolia

-- configure Wallet in env [TEMPORARY_MOXIE_HOLDING_WALLET_PRIVATE_KEY] that will be used to deposit funds to TokenLockManager contract

-- deposit funds into TokenLockManager contract
yarn hardhat manager-deposit --amount <<amt in MOXIE>> --network base-sepolia

-- give MoxiePass MINTER role to TokenLockManager contract <<sarvesh to execute>>

-- prepare and verify deployment files 

-- create token lock wallet contracts for the records mentioned in deploy csv.

yarn hardhat create-token-locks --deploy-file ./tasks/deploy-data.csv --result-file ./tasks/results.csv --owner-address <<multisig address>>  --network base-sepolia

-- Repeat the vesting contract deployment step for all different audience [team, investor, airdrop users]

-- token lock manager balance check

yarn hardhat manager-balance --network base-sepolia

-- whitelist token manager address in the token lock manager contract.

yarn hardhat set-token-manager --token-manager-address <<address>>   --network base-sepolia


-- whitelist the protocol functions and protocol address

	EasyAuction:
 	'placeSellOrders(uint256,uint96[],uint96[],bytes32[],bytes)',
   	'claimFromParticipantOrder(uint256,bytes32[])',
    'cancelSellOrders(uint256,bytes32[])',

yarn hardhat manager-setup-auth \
	--target-address <<easy-auction-address>> \
	--signatures '["placeSellOrders(uint256,uint96[],uint96[],bytes32[],bytes)","claimFromParticipantOrder(uint256,bytes32[])","cancelSellOrders(uint256,bytes32[])"]' \
	--network base-sepolia


    Bonding Curve:
     'buyShares(address,uint256,uint256)',
     'sellShares(address,uint256,uint256)'


    yarn hardhat manager-setup-auth \
	--target-address <<bonding-curve-proxy-address>> \
	--signatures '["buyShares(address,uint256,uint256)","sellShares(address,uint256,uint256)"]' \
	--network base-sepolia

 -- whitelist moxie bonding curve address in token lock manager [addSubjectTokenDestination]
	yarn hardhat add-subject-token-destination --protocol-contract-address  <<bonding curve proxy addrss>>  --network base-sepolia


-- transfer ownership of TokenLockManager contract
yarn hardhat manager-transfer-ownership --owner <<new owner>> --network base-sepolia
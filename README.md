## AutoYield

A decentralized savings dApp with 3 core features 
1. An ERC4626 yield vault with superform base strategy
2. An auto saver implementing chanlink keeper functions to automate savings.
3. A simple saver for locking up funds for specified period 

Solution is deployed on BSC testnet and primarily build to function on opera mini's minipay mobile wallet
The asset category include:

1. BNB USD stable: can be deposited in the vault, simple saver and the auto-saver.

2. BNB Native Coin: Using `Pyth oracle`, we implemented a dollar-cost-averaging model of savings. Here, `Pyth oracle` updates and pulls the price of BNB/Usd pair at current time abd 24hrs ago. We get the % difference and then check if it has a negative trent of greater than 5% before a deposit is permitted. This is hedging against the devaluation risk associated with holding Native assets as opposed to stablecoins.


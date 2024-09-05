// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/lib/chainlink-brownie-contracts/contracts/src/v0.8/AutomationCompatible.sol";
import "@pythnetwork/IPyth.sol";
import "@pythnetwork/PythStructs.sol";
contract AutoYield is ERC20, ReentrancyGuard {
    struct TokenBalance {
        uint256 bnbBalance;
        uint256 usdcBalance;
        uint256 depositTime;
        uint256 tokenIncentive;
    }

    mapping(address => TokenBalance) public balances;
    mapping(address => address) public upliners;
    mapping(address => address[]) public downliners;
    uint256 public lockDuration = 1 minutes; // for testing
    address public constant BNB_TOKEN_ADDRESS = address(0);
    address public constant USDC_TOKEN_ADDRESS =
        0x64544969ed7EBf5f083679233325356EbE738930;
    bool public due = false;

    uint256 public interval;
    uint256 public lastTimeStamp;

   IPyth public pyth;
    bytes32 BNBPriceId;
    constructor() ERC20("autoYieldToken", "AYT") {
        _mint(address(this), 21000000 * 1e18);
        interval = 1 minutes;
        lastTimeStamp = block.timestamp;
        pyth = IPyth(0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb);
        BNBPriceId = 0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f;
    }


    event Deposited(
        address indexed depositor,
        uint256 amount,
        address indexed token
    );
    event Withdrawn(
        address indexed withdrawer,
        uint256 amount,
        address indexed token
    );
    event TimelockBroken(address indexed breaker, uint256 totalSavings);
    event UplinerSet(address indexed user, address indexed upliner);
    event RewardDistributed(
        address indexed upliner,
        address indexed depositor,
        uint256 amount
    );

    receive() external payable {
        depositBNB();
    }

    function getPriceChange(bytes[] calldata priceUpdateData) public returns (int256) {
        uint fee = 5000000000000000;
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        bytes32 priceId = 0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f;
        uint256 age = 24 * 60 * 60;
        PythStructs.Price memory oldBasePrice = pyth.getPriceNoOlderThan(priceId, age);
        PythStructs.Price memory currentBasePrice = pyth.getPrice(priceId);
        int256 change = int256(currentBasePrice.price) - int256(oldBasePrice.price);
        int256 percentageChange = (int256(change) * 100) / int256(oldBasePrice.price);

        return percentageChange;
    }

    function updatePriceAndDeposit(bytes[] calldata pythPriceUpdate) public payable {
        uint fee = pyth.getUpdateFee(pythPriceUpdate);
        pyth.updatePriceFeeds{value: fee}(pythPriceUpdate);

        bytes32 priceId = 0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f;
        uint256 age = 24 * 60 * 60;
        PythStructs.Price memory oldBasePrice = pyth.getPriceNoOlderThan(priceId, age);
        PythStructs.Price memory currentBasePrice = pyth.getPrice(priceId);
        int256 change = int256(currentBasePrice.price) - int256(oldBasePrice.price);
        int256 percentageChange = (int256(change) * 100) / int256(oldBasePrice.price);
        if(percentageChange <= -1) {
        depositBNB();
        }
    }


    function setUpliner(address upliner) public {
        require(upliner != address(0), "Upliner cannot be the zero address");
        require(
            upliner != msg.sender,
            "You cannot set yourself as your upliner"
        );
        require(upliners[msg.sender] == address(0), "Upliner already set");
        upliners[msg.sender] = upliner;
        downliners[upliner].push(msg.sender);
        emit UplinerSet(msg.sender, upliner);
    }

    function getDownliners(
        address upliner
    ) public view returns (address[] memory) {
        return downliners[upliner];
    }
    function depositUSDC(uint256 amount) public nonReentrant {
        IERC20 usdcToken = IERC20(USDC_TOKEN_ADDRESS);
        require(
            usdcToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed."
        );
        TokenBalance storage usdcBalance = balances[msg.sender];
        usdcBalance.usdcBalance += amount;
        usdcBalance.depositTime = block.timestamp;
        emit Deposited(msg.sender, amount, USDC_TOKEN_ADDRESS);

        _mint(msg.sender, 1);
        TokenBalance storage tokenIncentive = balances[msg.sender];
        tokenIncentive.tokenIncentive += 1;

        distributeReferralReward(msg.sender, 1);
    }

    function deposit(
        address tokenAddress,
        uint256 amount
    ) public payable nonReentrant {
        if (tokenAddress == BNB_TOKEN_ADDRESS) {
            require(amount > 0, "BNB deposit amount must be greater than 0");
            TokenBalance storage bnbBalance = balances[msg.sender];
            bnbBalance.bnbBalance += amount;
            bnbBalance.depositTime = block.timestamp;
            bnbBalance.tokenIncentive = balanceOf(msg.sender);
            emit Deposited(msg.sender, amount, BNB_TOKEN_ADDRESS);
        } else if (tokenAddress == USDC_TOKEN_ADDRESS) {
            IERC20 usdcToken = IERC20(USDC_TOKEN_ADDRESS);
            require(
                usdcToken.transferFrom(msg.sender, address(this), amount),
                "Transfer failed. Make sure to approve the contract to spend the USDC tokens."
            );
            TokenBalance storage usdcBalance = balances[msg.sender];
            usdcBalance.usdcBalance += amount;
            usdcBalance.depositTime = block.timestamp;
            emit Deposited(msg.sender, amount, USDC_TOKEN_ADDRESS);
        } else {
            revert("Unsupported token");
        }
        _mint(msg.sender, 1);
        TokenBalance storage tokenIncentive = balances[msg.sender];
        tokenIncentive.tokenIncentive += 1;

        distributeReferralReward(msg.sender, 1);
    }




    function depositBNB() public payable nonReentrant {
        TokenBalance storage bnbBalance = balances[msg.sender];
        bnbBalance.bnbBalance += 1 * 1e18;
        bnbBalance.depositTime = block.timestamp;
        bnbBalance.tokenIncentive = balanceOf(msg.sender);
        emit Deposited(msg.sender, 1, BNB_TOKEN_ADDRESS);
        _mint(msg.sender, 1);
        TokenBalance storage tokenIncentive = balances[msg.sender];
        tokenIncentive.tokenIncentive += 1;

        distributeReferralReward(msg.sender, 1);
    }

    function distributeReferralReward(
        address depositor,
        uint256 amount
    ) internal {
        address upliner = upliners[depositor];
        if (upliner != address(0)) {
            uint256 uplinerReward = (amount * 10) / 100;
            _mint(upliner, uplinerReward);
            emit RewardDistributed(upliner, depositor, uplinerReward);
        }
    }

    function timeSinceDeposit(address depositor) public view returns (uint256) {
        return block.timestamp - balances[depositor].depositTime;
    }

    function breakTimelock(address tokenAddress) external payable nonReentrant {
        require(
            (balances[msg.sender].bnbBalance > 0 ||
                balances[msg.sender].usdcBalance > 0),
            "No savings to withdraw"
        );

        TokenBalance storage tokenBalance = balances[msg.sender];
        uint256 amount;
        if (timeSinceDeposit(msg.sender) < lockDuration) {
            due = true;
            uint256 tokenIncentive = tokenBalance.tokenIncentive;
            require(
                tokenIncentive >= 1,
                "Insufficient savings to break timelock"
            );

            if (tokenAddress == BNB_TOKEN_ADDRESS) {
                require(due == true, "Cannot withdraw before lock duration");
                amount = tokenBalance.bnbBalance;
                tokenBalance.bnbBalance = 0;
                (bool success, ) = payable(msg.sender).call{value: amount}("");
                require(success, "BNB transfer failed");
            } else if (tokenAddress == USDC_TOKEN_ADDRESS) {
                require(due == true, "Cannot withdraw before lock duration");
                amount = tokenBalance.usdcBalance;
                tokenBalance.usdcBalance = 0;
                IERC20 usdcToken = IERC20(USDC_TOKEN_ADDRESS);
                require(
                    usdcToken.transfer(msg.sender, amount),
                    "USDC transfer failed"
                );
            } else {
                revert("Unsupported token");
            }
            approve(msg.sender, tokenIncentive);
            transferFrom(msg.sender, address(this), tokenIncentive);
            emit TimelockBroken(msg.sender, 1);
        }
    }

    function withdraw(address tokenAddress) external nonReentrant {
        TokenBalance storage tokenBalance = balances[msg.sender];
        if (
            (tokenBalance.bnbBalance > 0 &&
                timeSinceDeposit(msg.sender) >= lockDuration) ||
            (tokenBalance.usdcBalance > 0 &&
                timeSinceDeposit(msg.sender) >= lockDuration)
        ) {
            due = true;
        } else {
            revert("Cannot withdraw before lock duration");
        }

        uint256 amount;
        if (tokenAddress == BNB_TOKEN_ADDRESS) {
            amount = tokenBalance.bnbBalance;
            tokenBalance.bnbBalance = 0;
            payable(msg.sender).transfer(amount);
        } else if (tokenAddress == USDC_TOKEN_ADDRESS) {
            amount = tokenBalance.usdcBalance;
            tokenBalance.usdcBalance = 0;
            IERC20 usdcToken = IERC20(USDC_TOKEN_ADDRESS);
            require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
        } else {
            revert("Unsupported token");
        }

        emit Withdrawn(msg.sender, amount, tokenAddress);
    }

    function getBalance(
        address account,
        address tokenAddress
    ) public view returns (uint256) {
        TokenBalance storage tokenBalance = balances[account];
        if (tokenAddress == BNB_TOKEN_ADDRESS) {
            return tokenBalance.bnbBalance;
        } else if (tokenAddress == USDC_TOKEN_ADDRESS) {
            return tokenBalance.usdcBalance;
        } else {
            revert("Unsupported token");
        }
    }

    function checkUpkeep() external view returns (bool upkeepNeeded) {
        upkeepNeeded = (block.timestamp - lastTimeStamp) > interval;
    }

    function performUpkeep(
        address tokenAddress,
        uint256 amount,
        bytes[] calldata pythPriceUpdate
    ) external {
        if ((block.timestamp - lastTimeStamp) > interval) {
            lastTimeStamp = block.timestamp;
            if (tokenAddress == USDC_TOKEN_ADDRESS) {
                depositUSDC(amount);
            }
            if (tokenAddress == BNB_TOKEN_ADDRESS) {
                updatePriceAndDeposit(pythPriceUpdate);
            }
        }
    }

    /**    function saveFixedAmount() internal {
        uint256 amount = 1 * 1e18; // Example amount to save
        // Implement the logic to save the amount for all users or specific users
        // Example: Transfer tokens from the contract to users or another contract
    } */
}
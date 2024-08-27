import React, { useState, useCallback, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { contractAddress, abi } from '../../utils/abi';
import { BrowserProvider, Contract, formatUnits } from "ethers";
import { CurrencyDollarIcon, CurrencyPoundIcon } from "@heroicons/react/24/outline";
import TransactionList from '@/components/TransactionList';
import { BigNumber } from "alchemy-sdk";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { parseEther } from 'viem';



const Loader = ({ alt }: { alt?: boolean }) => (
  <div className={`loader ${alt ? 'loader-alt' : ''}`}>Loading...</div>
);


export default function Home() {
  const USDCTokenAddress = "0x64544969ed7EBf5f083679233325356EbE738930";
  const BNBAddress = "0x0000000000000000000000000000000000000000";

  const [depositAmount, setDepositAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [BNBBalance, setBNBBalance] = useState('');
  const [USDCBalance, setUSDCBalance] = useState('');
  const [tokenBalance, setTokenBalance] = useState('');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingTx, setIsWaitingTx] = useState(false);
  const [buttonText, setButtonText] = useState('Approve');
  const [feedUpdateData, setFeedUpdateData] = useState<Array<string>>([]);
  const [priceChange, setPriceChange] = useState("");

  const getPriceChange = useCallback(async () => {
    if (window.ethereum) {
      try {
        let accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        let userAddress = accounts[0];
        const connection = new EvmPriceServiceConnection(
          "https://hermes.pyth.network"
        );
        const priceIds = ["0x7d669ddcdd23d9ef1fa9a9cc022ba055ec900e91c4cb960f3c20429d4447a411" as any];
        const priceFeedUpdateData =
          await connection.getPriceFeedsUpdateData(priceIds);
        setFeedUpdateData(priceFeedUpdateData);
        console.log(priceFeedUpdateData);
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(userAddress);
        const contract = new Contract(contractAddress, abi, signer);
        const gasLimit = parseInt("6000000");
        const priceChange = await contract.getPriceChange(feedUpdateData, { value: parseEther("0.0005"), gasLimit });
        setPriceChange(priceChange);
        console.log("Retrieved Pyth price update:", priceChange);
      } catch (error) {
        console.error("Error fetching price change:", error);
        toast.error("Error fetching price change");
      }
    }
  }, []);

  const getBalance = useCallback(async () => {
    if (window.ethereum) {
      try {
        let accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        let userAddress = accounts[0];

        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(userAddress);
        const contract = new Contract(contractAddress, abi, signer);

        const balanceStruct = await contract.balances(userAddress);
        if (balanceStruct && balanceStruct.BNBBalance !== undefined) {
          const BNBBalanceBigInt = formatUnits(balanceStruct.BNBBalance, 18);
          setBNBBalance(BNBBalanceBigInt.toString());

          const USDCBalance = await contract.getBalance(userAddress, USDCTokenAddress);
          if (USDCBalance !== undefined) {
            const USDCBalanceBigInt = formatUnits(USDCBalance, 18);
            setUSDCBalance(USDCBalanceBigInt.toString());
          }
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
        toast.error("Error fetching balance");
      }
    }
  }, []);

  const getTokenBalance = useCallback(async () => {
    if (window.ethereum) {
      try {
        let accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        let userAddress = accounts[0];

        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(userAddress);
        const contract = new Contract(contractAddress, abi, signer);

        const tokenBalance = await contract.balanceOf(userAddress);
        if (tokenBalance !== undefined) {
          const tokenBalanceBigInt = formatUnits(tokenBalance, 0);
          setTokenBalance(tokenBalanceBigInt.toString());
        }
      } catch (error) {
        console.error("Error fetching token balance:", error);
        toast.error("Error fetching token balance");
      }
    }
  }, []);

  const handleTokenChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedToken(event.target.value);
  };

  const approveSpend = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsApproving(true);

    if (window.ethereum) {
      try {
        let accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        let userAddress = accounts[0];

        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(userAddress);

        // Ensure depositAmount is valid
        if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
          toast.error('Invalid deposit amount');
          setIsApproving(false);
          return;
        }

        const depositValue = parseEther(depositAmount.toString());
        const gasLimit = parseInt("600000");

        const tokenAddress = selectedToken === 'USDC' ? USDCTokenAddress : BNBAddress;
        const tokenAbi = [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)"
        ];
        const tokenContract = new Contract(tokenAddress, tokenAbi, signer);

        const allowance = await tokenContract.allowance(userAddress, contractAddress);
        const allowanceBigNumber = BigNumber.from(allowance);

        if (allowanceBigNumber.gte(depositValue)) {
          setIsApproved(true);
          toast.success('Already approved!');
        } else {
          let tx = await tokenContract.approve(contractAddress, depositValue, { gasLimit });
          setButtonText('Approving...');
          await tx.wait();
          setIsApproved(true);
          toast.success('Approval successful!');
        }
      } catch (error) {
        console.error("Error approving spend:", error);
        setIsApproved(false);
        toast.error('Approval failed!');
      }
    } else {
      toast.error('Ethereum object not found');
    }

    setIsApproving(false);
  };


  const handleDeposit = async (event: React.FormEvent, selectedToken: string, depositAmount: number) => {
    event.preventDefault();
    if (!depositAmount || !selectedToken) return;
    setIsWaitingTx(true);
    try {
      if (window.ethereum) {
        let accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        let userAddress = accounts[0];
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(userAddress);
        const contract = new Contract(contractAddress, abi, signer);
        const depositValue = parseEther(depositAmount.toString());
        const gasLimit = parseInt("6000000");

        let tx;
        if (selectedToken === 'USDC') {
          const connection = new EvmPriceServiceConnection(
            "https://hermes.pyth.network"
          );
          const priceIds = ["0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f" as any];
          const priceFeedUpdateData =
            await connection.getPriceFeedsUpdateData(priceIds);
          setFeedUpdateData(priceFeedUpdateData);
          tx = await contract.performUpkeep(USDCTokenAddress, depositValue, feedUpdateData, { gasLimit });
        }
        else if (selectedToken === 'BNB') {
          const connection = new EvmPriceServiceConnection(
            "https://hermes.pyth.network"
          );
          const priceIds = ["0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f" as any];
          const priceFeedUpdateData =
            await connection.getPriceFeedsUpdateData(priceIds);
          setFeedUpdateData(priceFeedUpdateData);
          tx = await contract.updatePriceAndDeposit(feedUpdateData, { fee: parseEther("0.0005"), gasLimit }); //deposit 1 BNB
        }
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          console.log('Deposit successful');
          getBalance();
          getTokenBalance();
          setDepositAmount(0);
          setIsApproved(false);
          toast.success('Deposit successful!');
        } else {
          console.error('Transaction failed:', receipt);
          toast.error('Deposit failed!');
        }
      }
    } catch (error) {
      console.error("Error making deposit:", error);
      toast.error('Deposit failed!');
    }

    setIsWaitingTx(false);
    setButtonText('Deposit');
  };

  const handleWithdraw = async () => {
    if (!selectedToken) return;
    if (window.ethereum) {
      let accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      let userAddress = accounts[0];
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner(userAddress);
      const contract = new Contract(contractAddress, abi, signer);
      const gasLimit = parseInt("600000");

      try {
        let tx;
        if (selectedToken === 'BNB') {
          tx = await contract.withdraw(BNBAddress, { gasLimit });
        } else if (selectedToken === 'USDC') {
          tx = await contract.withdraw(USDCTokenAddress, { gasLimit });
        }
        await tx.wait();
        getBalance();
        getTokenBalance();
        setWithdrawAmount(0);
        toast.success('Withdrawal successful!');
      } catch (error) {
        console.error("Error making withdrawal:", error);
        toast.error('Withdrawal failed!');
      }
    }
  };

  const handleBreakLock = async () => {
    if (window.ethereum) {
      let accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      let userAddress = accounts[0];
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner(userAddress);
      const contract = new Contract(contractAddress, abi, signer);
      const gasLimit = parseInt("600000");

      try {
        let tx;
        if (selectedToken === 'BNB') {
          tx = await contract.breakTimelock(BNBAddress, { gasLimit });
        } else if (selectedToken === 'USDC') {
          tx = await contract.breakTimelock(USDCTokenAddress, { gasLimit });
        }
        await tx.wait();
        getBalance();
        getTokenBalance();
        toast.success('Timelock broken successfully!');
      } catch (error) {
        console.error("Error breaking timelock:", error);
        toast.error('Error breaking timelock');
      }
    }
  };

  useEffect(() => {
    getBalance();
    getTokenBalance();
    getPriceChange();
  }, [getBalance, getTokenBalance, getPriceChange]);

  return (
    <div className="container mx-auto p-4 lg:p-0">
      <ToastContainer />
      <div className="flex flex-col lg:flex-row text-sm ">
        <aside className="w-full lg:w-1/3 p-4">
          <div className="bg-gradient-to-br from-white to-gray-50 bg-opacity-75 backdrop-filter backdrop-blur-lg border border-gray-300 rounded-lg shadow-lg">
            <div className="p-6">
              <h3 className="font-semibold text-black mb-4 text-lg">My Savings</h3>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600"><CurrencyDollarIcon className="mr-2 text-black" />BNB:</span>
                  <span className="text-black text-2xl font-bold">{BNBBalance} BNB</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600"><CurrencyDollarIcon className="mr-2 text-black" />USDC:</span>
                  <span className="text-black text-2xl font-bold">{USDCBalance} USDC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600"><CurrencyPoundIcon className="mr-2 text-black" />AST:</span>
                  <span className="text-black text-2xl font-bold">{tokenBalance} AST</span>
                </div>
              </div>
              <div>
                <label htmlFor="token-select" className="block text-gray-600 mb-2">Select token you want to deposit</label>
                <select
                  id="token-select"
                  value={selectedToken}
                  onChange={handleTokenChange}
                  className="w-full rounded-md p-2 shadow bg-black text-white hover:bg-prosperity hover:text-black"
                >
                  <option value="USDC"><CurrencyDollarIcon className="mr-2" />USDC</option>
                  <option value="BNB"><CurrencyDollarIcon className="mr-2" />BNB</option>
                </select>
              </div>
            </div>
          </div>
        </aside>
        <aside className="w-full lg:w-1/3 p-4">
          <h3 className="font-semibold text-black mb-4 text-lg">BNB/USD Price change on 24hours Price Chart</h3>
          <span className="text-black text-3xl font-semibold">{priceChange} %</span>
        </aside>
        <main className="w-full lg:w-2/3 p-4">
          <div className="bg-white p-6 rounded-lg shadow-md mb-4 bg-gradient-to-br from-white to-gray-50 bg-opacity-75 backdrop-filter backdrop-blur-lg border border-gray-300 rounded-lg shadow-lg">
            <div className="bg-white p-6 rounded-lg shadow-md mb-4 bg-gradient-to-br from-white to-gray-50 bg-opacity-75 backdrop-filter backdrop-blur-lg border border-gray-300 rounded-lg shadow-lg">
              <h3 className="text-sm font-semibold text-black mb-2">Schedule your Savings</h3>
              <form
                className="mb-4">
                <div className="mb-4">
                  <label className="text-sm font-light text-gray-500 mb-2" htmlFor="deposit-amount">Amount</label>
                  <label className="flex text-xs font-light text-gray-500 mb-2" htmlFor="deposit-amount">Approve amount before depositing...</label>
                  <input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="border rounded px-4 py-2 w-full mb-2 text-black"
                  />
                </div>
                <button
                  disabled={isApproved}
                  onClick={(e) => approveSpend(e)}
                  className={`${!isApproved
                    ? "text-white bg-black hover:bg-prosperity hover:text-black"
                    : "bg-black/10 cursor-not-allowed text-white"
                    } inline-flex w-full text-black items-center justify-center rounded-md p-2 mb-2 `}                >
                  {isApproving ? <Loader alt /> : "Approve"}
                </button>
                <button
                  disabled={!isApproved}
                  onClick={(e) => handleDeposit(e, selectedToken, depositAmount)}
                  className={`${isApproved
                    ? "text-white bg-black hover:bg-prosperity hover:text-black"
                    : "bg-black/10 cursor-not-allowed text-white hover:bg-prosperity hover:text-black"
                    } inline-flex w-full items-center justify-center rounded-md p-2`}
                >
                  {isWaitingTx ? <Loader alt /> : "Start Cycle"}
                </button>
              </form>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md mb-4 bg-gradient-to-br from-white to-gray-50 bg-opacity-75 backdrop-filter backdrop-blur-lg border border-gray-300 rounded-lg shadow-lg">
              <h3 className="text-sm font-semibold text-black mb-2">Withdraw</h3>
              <button
                type="submit"
                onClick={handleWithdraw}
                className="w-full bg-black shadow text-white py-2 rounded-md hover:bg-prosperity hover:text-black transition"
              >
                Withdraw
              </button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md mb-4 bg-gradient-to-br from-white to-gray-50 bg-opacity-75 backdrop-filter backdrop-blur-lg border border-gray-300 rounded-lg shadow-lg">
              <h3 className="text-sm font-semibold text-black mb-2">Break Timelock</h3>
              <h3 className="text-sm font-light text-gray-500 mb-2">Ensure you have enough EST tokens</h3>

              <button
                onClick={handleBreakLock}
                className="w-full bg-black shadow text-white py-2 rounded-md hover:bg-prosperity hover:text-black transition"
              >
                Breaklock
              </button>
            </div>
          </div>
        </main>
        <aside className="w-full lg:w-1/3 p-4 border rounded-md">
          <TransactionList />

        </aside>
      </div>
    </div>
  );
}

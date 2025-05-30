"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentAccount, useWallets, useConnectWallet, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { 
  SUPPORTED_TOKENS, 
  TokenInfo, 
  getTokenBalance, 
  buildEncryptTokenTransaction, 
  getTransactionHistory,
  verifyContractModule,
  EncryptedTokenData,
  saveEncryptedToken,
  getEncryptedTokensByStatus
} from "@/lib/tokens";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import CryptoJS from 'crypto-js';
import Cookies from 'js-cookie';
import { auth } from '@/lib/firebase';
import { Navbar } from "@/components/Navbar";

interface EncryptedTransaction {
  id: string;
  type: 'encrypt' | 'decrypt';
  tokenType: string;
  amount: string;
  sender: string;
  recipient: string;
  encryptedData: string;
  status: string;
  timestamp: number;
}

interface TransactionDisplayProps {
  id?: string;
  txHash?: string;
  type: string;
  tokenType: string;
  amount: string;
  status: string;
  timestamp: number;
}

// Update the formatBalance function to handle decimal inputs
const formatBalance = (balance: string, decimals: number = 9): string => {
  try {
    if (!balance) return '0.0000';
    
    // If the balance is already in decimal format (e.g., "0.11")
    if (balance.includes('.')) {
      const [integerPart, fractionalPart = ''] = balance.split('.');
      const paddedFractional = fractionalPart.padEnd(decimals, '0');
      const fullNumber = integerPart + paddedFractional;
      const value = BigInt(fullNumber);
      const divisor = BigInt(10 ** decimals);
      const formattedInteger = value / divisor;
      const formattedFractional = (value % divisor).toString().padStart(decimals, '0');
      const formattedAmount = `${formattedInteger}.${formattedFractional.slice(0, 4)}`;
      return formattedAmount.replace(/\.?0+$/, '');
    }

    // If the balance is in smallest unit format (e.g., "110000000")
    const value = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = (value % divisor).toString().padStart(decimals, '0');
    const formattedAmount = `${integerPart}.${fractionalPart.slice(0, 4)}`;
    return formattedAmount.replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0.0000';
  }
};

// Add a helper function to convert decimal to smallest unit
const decimalToSmallestUnit = (amount: string, decimals: number): bigint => {
  try {
    if (!amount) return BigInt(0);
    
    // Handle decimal input
    if (amount.includes('.')) {
      const [integerPart, fractionalPart = ''] = amount.split('.');
      const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
      const fullNumber = integerPart + paddedFractional;
      return BigInt(fullNumber);
    }
    
    // Handle integer input
    return BigInt(amount) * BigInt(10 ** decimals);
  } catch (error) {
    console.error('Error converting to smallest unit:', error);
    return BigInt(0);
  }
};

// Add a helper function to format transaction amounts
const formatTransactionAmount = (amount: string, token: string): string => {
  const tokenInfo = SUPPORTED_TOKENS[token as keyof typeof SUPPORTED_TOKENS];
  if (!tokenInfo) return amount;
  return formatBalance(amount, tokenInfo.decimals);
};

// Add this function at the top level, after the formatBalance function
const generateUniqueId = (() => {
  let counter = 0;
  return () => `tx-${counter++}`;
})();

export default function DashboardPage() {
  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: string }>({});
  const [transactions, setTransactions] = useState<TransactionDisplayProps[]>([]);
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [encryptAmount, setEncryptAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(SUPPORTED_TOKENS.WAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [activeTab, setActiveTab] = useState("account");
  const [contractVerified, setContractVerified] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [encryptedTokens, setEncryptedTokens] = useState<EncryptedTokenData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionDisplayProps[]>([]);
  
  const router = useRouter();
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutateAsync: connectWallet } = useConnectWallet();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransactionBlock();

  // Check authentication and load data
  useEffect(() => {
    const isInternalWalletConnected = Cookies.get('internal_wallet_connected') === 'true';
    const isSuiWalletConnected = Cookies.get('sui_wallet_connected') === 'true';
    
    if (!isInternalWalletConnected && !isSuiWalletConnected) {
      router.push('/');
      return;
    }

    if (account) {
      fetchBalances();
      fetchTransactionHistory();
      setConnected(true);
      setIsAuthenticated(true);
    }
  }, [account]);

  // Add contract verification
  useEffect(() => {
    async function verifyContract() {
      try {
        const packageInfo = await verifyContractModule();
        console.log("Contract verification successful:", packageInfo);
        setContractVerified(true);
        setContractError(null);
      } catch (error) {
        console.error("Contract verification failed:", error);
        setContractError(error instanceof Error ? error.message : "Failed to verify contract");
        setContractVerified(false);
      }
    }

    if (account) {
      verifyContract();
    }
  }, [account]);

  // Fetch balances
  const fetchBalances = async () => {
    if (!account) return;

    try {
      const balances: { [key: string]: string } = {};
      for (const [symbol, token] of Object.entries(SUPPORTED_TOKENS)) {
        const balance = await getTokenBalance(account.address, token);
        balances[symbol] = balance;
      }
      setTokenBalances(balances);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching balances:", error);
      setIsLoading(false);
    }
  };

  // Add this function to format transaction display
  const formatTransactionDisplay = (tx: any): TransactionDisplayProps => {
    return {
      type: tx.type || 'Unknown',
      tokenType: tx.tokenType || tx.token || 'Unknown',
      amount: tx.amount || '0',
      status: tx.status || 'pending',
      timestamp: tx.timestamp || Date.now()
    };
  };

  // Update fetchTransactionHistory
  const fetchTransactionHistory = async () => {
    if (!account) return;
    try {
      const [lockedTokens, sentTokens, receivedTokens] = await Promise.all([
        getEncryptedTokensByStatus('locked', account.address),
        getEncryptedTokensByStatus('sent', account.address),
        getEncryptedTokensByStatus('received', account.address)
      ]);

      // Format and combine transactions
      const allTransactions = [
        ...lockedTokens.map(token => ({
          id: token.id || token.txDigest,
          type: 'Encrypt',
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status,
          timestamp: token.timestamp
        })),
        ...sentTokens.map(token => ({
          id: token.id || token.txDigest,
          type: 'Send',
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status,
          timestamp: token.timestamp
        })),
        ...receivedTokens.map(token => ({
          id: token.id || token.txDigest,
          type: 'Receive',
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status,
          timestamp: token.timestamp
        }))
      ].sort((a, b) => b.timestamp - a.timestamp)
       .slice(0, 5); // Only show last 5 transactions

      setRecentTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    }
  };

  // Update handleEncrypt function
  const handleEncrypt = async () => {
    if (!account || !encryptAmount || isProcessing) return;

    if (!contractVerified) {
      alert("Smart contract not verified. Please try again later.");
      return;
    }

    setIsProcessing(true);
    try {
      // Validate input amount
      const parsedAmount = parseFloat(encryptAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }

      // Convert amount to smallest unit considering token decimals
      const amountInSmallestUnit = decimalToSmallestUnit(encryptAmount, selectedToken.decimals);

      // Check if user has sufficient balance
      const currentBalance = tokenBalances[selectedToken.symbol] || "0";
      if (amountInSmallestUnit > BigInt(currentBalance)) {
        throw new Error("Insufficient balance");
      }

      // Create encryption key and encrypt data
      const encryptionKey = CryptoJS.SHA256(account.address + Date.now()).toString();
      const timestamp = Date.now();
      const dataToEncrypt = {
        amount: amountInSmallestUnit.toString(),
        token: selectedToken.symbol,
        timestamp,
        sender: account.address,
        key: encryptionKey
      };
      
      const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(dataToEncrypt), encryptionKey).toString();

      // Build transaction
      const tx = buildEncryptTokenTransaction(
        amountInSmallestUnit.toString(),
        selectedToken,
        encryptedData,
        account.address,
        account.address  // Use the same address as both sender and recipient
      );

      // Sign and execute transaction
      const result = await signAndExecute({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      }).catch(error => {
        console.error('Transaction error:', error);
        throw new Error(error.message || 'Transaction failed');
      });

      if (result) {
        const encryptedToken = {
          txDigest: result.digest,
          encryptedData,
          encryptionKey,
          amount: amountInSmallestUnit.toString(), // Store the raw amount
          token: selectedToken.symbol,
          timestamp,
          sender: account.address,
          recipient: account.address, // Store the recipient address
          status: 'locked' as const
        };

        await saveEncryptedToken(encryptedToken);
        await fetchBalances();
        await fetchTransactionHistory();
        setShowEncryptDialog(false);
        setEncryptAmount("");

        alert("Tokens locked successfully! The encryption key has been saved.");
      }
    } catch (error) {
      console.error("Encryption error:", error);
      alert(error instanceof Error ? error.message : "Failed to encrypt tokens. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle wallet connection
  const handleConnect = async () => {
    if (wallets && wallets.length > 0) {
      try {
        await connectWallet({ wallet: wallets[0] });
        Cookies.set('sui_wallet_connected', 'true', { path: '/' });
        fetchBalances();
        fetchTransactionHistory();
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  // Handle wallet disconnection
  const handleDisconnect = () => {
    Cookies.remove('sui_wallet_connected');
    Cookies.remove('internal_wallet_connected');
    router.push('/');
  };

  const authenticateUser = async () => {
    // Implement the logic to authenticate the user with Firebase
    setLoading(true);
    // Replace this with actual Firebase authentication logic
    setIsAuthenticated(true);
    setLoading(false);
  };

  if (!connected) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Ownly Protocol</h1>
          <p className="text-gray-400">Please connect your wallet using the button in the navigation bar</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Ownly Protocol</h1>
          <p className="text-gray-400">Authenticating your wallet...</p>
          <Button onClick={authenticateUser} disabled={loading}>
            {loading ? "Authenticating..." : "Authenticate Wallet"}
          </Button>
        </div>
      </main>
    );
  }

  if (contractError) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Contract Error</h1>
          <p className="text-red-400">{contractError}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto p-4">
    
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
            onClick={() => router.push('/dashboard/history')}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          >
            History
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Token Balances */}
          <div className="col-span-12 md:col-span-4 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Token Balances</h2>
            {Object.entries(SUPPORTED_TOKENS).map(([symbol, token]) => (
              <Card key={`token-${symbol}`} className="p-4 border-gray-700 bg-gray-800">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{token.name}</h3>
                    <p className="text-sm text-gray-400">{symbol}</p>
                  </div>
                  <p className="text-xl text-white">
                    {formatBalance(tokenBalances[symbol] || "0", token.decimals)}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-8">
            {/* Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card className="p-6 border-gray-700 bg-gray-800">
                <h2 className="text-lg font-semibold mb-4">ENCRYPT</h2>
                <p className="text-sm text-gray-400 mb-4">Encrypt your tokens for secure storage</p>
                <Button
                  onClick={() => setShowEncryptDialog(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Encrypt Tokens
                </Button>
              </Card>
              <Card className="p-6 border-gray-700 bg-gray-800">
                <h2 className="text-lg font-semibold mb-4">SEND</h2>
                <p className="text-sm text-gray-400 mb-4">Send your encrypted tokens</p>
                <Button
                  onClick={() => router.push('/dashboard/send')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Send Tokens
                </Button>
              </Card>
              <Card className="p-6 border-gray-700 bg-gray-800">
                <h2 className="text-lg font-semibold mb-4">DECRYPT</h2>
                <p className="text-sm text-gray-400 mb-4">View and decrypt received tokens</p>
                <Button
                  onClick={() => router.push('/dashboard/decrypt')}
                  className="w-full"
                >
                  Manage Encrypted
                </Button>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="col-span-2 p-6 bg-gray-800 border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {recentTransactions.length === 0 ? (
                  <p className="text-gray-400">No recent activity</p>
                ) : (
                  <div className="grid gap-4 pr-2">
                    {recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 rounded-lg border bg-gray-900 border-gray-700"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                tx.type === 'Encrypt' ? 'bg-blue-900 text-blue-200' :
                                tx.type === 'Send' ? 'bg-purple-900 text-purple-200' :
                                'bg-green-900 text-green-200'
                              }`}>
                                {tx.type}
                              </span>
                              <h3 className="font-medium">{tx.tokenType}</h3>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              Amount: {formatBalance(tx.amount, SUPPORTED_TOKENS[tx.tokenType]?.decimals || 9)}
                            </p>
                            <p className="text-sm text-gray-400">
                              {new Intl.DateTimeFormat('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }).format(new Date(tx.timestamp))}
                            </p>
                          </div>
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              tx.status === 'locked' ? 'bg-blue-900 text-blue-200' :
                              tx.status === 'sent' ? 'bg-purple-900 text-purple-200' :
                              'bg-green-900 text-green-200'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Encrypt Dialog */}
      <Dialog open={showEncryptDialog} onOpenChange={setShowEncryptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encrypt Tokens</DialogTitle>
            <DialogDescription>
              Encrypt your tokens for secure storage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Token</Label>
              <select
                className="w-full p-2 mt-1 bg-gray-800 border border-gray-700 rounded text-white"
                value={selectedToken.symbol}
                onChange={(e) => setSelectedToken(SUPPORTED_TOKENS[e.target.value as keyof typeof SUPPORTED_TOKENS])}
              >
                {Object.entries(SUPPORTED_TOKENS).map(([symbol, token]) => (
                  <option key={`select-${symbol}`} value={symbol}>
                    {token.name} ({symbol}) - Balance: {formatBalance(tokenBalances[symbol] || "0", token.decimals)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={encryptAmount}
                onChange={(e) => setEncryptAmount(e.target.value)}
                className="bg-gray-800 border-gray-700"
                step="0.000001"
                min="0"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={() => setShowEncryptDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEncrypt}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Encrypt"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
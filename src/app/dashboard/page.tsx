"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentAccount, useWallets, useConnectWallet, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
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
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import CryptoJS from 'crypto-js';
import Cookies from 'js-cookie';
import { auth } from '@/lib/firebase';
import { Navbar } from "@/components/Navbar";
import { formatBalance, decimalToSmallestUnit, formatTransactionAmount, generateUniqueId } from "@/lib/utils/format";

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
  id: string;
  type: 'Encrypt' | 'Send' | 'Receive' | 'Decrypt';
  tokenType: string;
  amount: string;
  status: 'locked' | 'sent' | 'received' | 'decrypted';
  timestamp: number;
  sender: string;
  recipient?: string;
}

// Add this helper function at the top level
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getTransactionWithRetry = async (client: SuiClient, digest: string, maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Wait for a bit before trying (increase wait time with each retry)
      await sleep(1000 * (i + 1));
      
      const txResponse = await client.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
        },
      });
      
      return txResponse;
  } catch (error) {
      console.log(`Attempt ${i + 1} failed, retrying...`);
      if (i === maxRetries - 1) throw error;
    }
  }
};

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
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Check authentication and load data
  useEffect(() => {
    const isInternalWalletConnected = Cookies.get('internal_wallet_connected') === 'true';
    const isSuiWalletConnected = Cookies.get('sui_wallet_connected') === 'true';
    
    if (!isInternalWalletConnected && !isSuiWalletConnected) {
      router.push('/');
      return;
    }

    if (account) {
      // Refresh data when dashboard is mounted
      const refreshData = async () => {
        try {
          setIsLoading(true);
          await Promise.all([
            fetchBalances(),
            fetchTransactionHistory()
          ]);
        } catch (error) {
          console.error('Error refreshing data:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      refreshData();
      setConnected(true);
      setIsAuthenticated(true);

      // Set up an interval to refresh balances periodically
      const refreshInterval = setInterval(refreshData, 5000); // Refresh every 5 seconds

      return () => clearInterval(refreshInterval);
    }
  }, [account]); // Remove router.asPath dependency

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

  // Update the formatTransactionDisplay function
  const formatTransactionDisplay = (tx: any): TransactionDisplayProps => {
    return {
      id: `${tx.id || tx.txDigest || Date.now()}-${tx.type || 'unknown'}-${tx.timestamp || Date.now()}`,
      type: (tx.type as 'Encrypt' | 'Send' | 'Receive' | 'Decrypt') || 'Encrypt',
      tokenType: tx.tokenType || tx.token || 'Unknown',
      amount: tx.amount || '0',
      status: (tx.status as 'locked' | 'sent' | 'received' | 'decrypted') || 'locked',
      timestamp: tx.timestamp || Date.now(),
      sender: tx.sender || '',
      recipient: tx.recipient
    };
  };

  // Update fetchTransactionHistory
  const fetchTransactionHistory = async () => {
    if (!account) return;
    try {
      const [locked, sent, received, decrypted] = await Promise.all([
        getEncryptedTokensByStatus('locked', account.address),
        getEncryptedTokensByStatus('sent', account.address),
        getEncryptedTokensByStatus('received', account.address),
        getEncryptedTokensByStatus('decrypted', account.address)
      ]);

      // Update the transaction processing
      const allTransactions: TransactionDisplayProps[] = [
        ...locked.map(token => ({
          id: `${token.id || token.txDigest}-locked-${token.timestamp}`,
          type: 'Encrypt' as const,
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status as 'locked' | 'sent' | 'received' | 'decrypted',
          timestamp: token.timestamp,
          sender: token.sender,
          recipient: token.recipient
        })),
        ...sent.map(token => ({
          id: `${token.id || token.txDigest}-sent-${token.timestamp}`,
          type: 'Send' as const,
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status as 'locked' | 'sent' | 'received' | 'decrypted',
          timestamp: token.timestamp,
          sender: token.sender,
          recipient: token.recipient
        })),
        ...received.map(token => ({
          id: `${token.id || token.txDigest}-received-${token.timestamp}`,
          type: 'Receive' as const,
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status as 'locked' | 'sent' | 'received' | 'decrypted',
          timestamp: token.timestamp,
          sender: token.sender,
          recipient: token.recipient
        })),
        ...decrypted.map(token => ({
          id: `${token.id || token.txDigest}-decrypted-${token.timestamp}`,
          type: 'Decrypt' as const,
          tokenType: token.token,
          amount: formatTransactionAmount(token.amount, token.token),
          status: token.status as 'locked' | 'sent' | 'received' | 'decrypted',
          timestamp: token.timestamp,
          sender: token.sender,
          recipient: token.recipient
        }))
      ]

      // Create a Map to store unique transactions
      const uniqueTransactions = new Map<string, TransactionDisplayProps>();

      // Add all transactions to the Map, automatically removing duplicates
      allTransactions.forEach(transaction => {
        uniqueTransactions.set(transaction.id, transaction);
      });

      // Convert back to array, sort, and limit
      const finalTransactions = Array.from(uniqueTransactions.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

      setRecentTransactions(finalTransactions);
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

      // Set the sender address
      tx.setSender(account.address);

      // Properly serialize and encode the transaction
      const bytes = await tx.build({ 
        client: new SuiClient({ url: getFullnodeUrl('testnet') })
      });
      const serializedTx = btoa(String.fromCharCode(...bytes));

      // Sign and execute transaction
      const result = await signAndExecuteTransaction({
        transaction: serializedTx
      }).catch((error: Error) => {
        console.error('Transaction error:', error);
        throw new Error(error.message || 'Transaction failed');
      });

      if (!result) {
        throw new Error('Transaction failed');
      }

      console.log('Transaction result:', result);

      // Get the transaction details to find the lock object ID
      const client = new SuiClient({ url: getFullnodeUrl('testnet') });
      
      console.log('Waiting for transaction to be indexed...');
      const txResponse = await getTransactionWithRetry(client, result.digest);

      if (!txResponse || !txResponse.objectChanges) {
        throw new Error('Failed to get transaction response or object changes');
      }

      console.log('Transaction response:', txResponse);

      // Find the created shared object ID
      let lockObjectId = null;
      for (const change of txResponse.objectChanges) {
        if (change.type === 'created' && change.owner && typeof change.owner === 'object' && 'Shared' in change.owner) {
          lockObjectId = change.objectId;
          console.log('Found lock object ID:', lockObjectId);
          break;
        }
      }

      if (!lockObjectId) {
        console.error('Transaction response:', txResponse);
        throw new Error('Failed to get lock object ID from transaction. Please check the transaction details.');
      }

        const encryptedToken = {
          txDigest: result.digest,
          encryptedData,
          encryptionKey,
          amount: amountInSmallestUnit.toString(),
          token: selectedToken.symbol,
        timestamp,
          sender: account.address,
        recipient: account.address,
        status: 'locked' as const,
        lockObjectId
        };

      console.log('Saving encrypted token:', encryptedToken);

      await saveEncryptedToken(encryptedToken);
        await fetchBalances();
        await fetchTransactionHistory();
        setShowEncryptDialog(false);
        setEncryptAmount("");

        alert("Tokens locked successfully! The encryption key has been saved.");
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
              <Card key={`token-${symbol}`} className="p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{token.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{symbol}</p>
                  </div>
                  <p className="text-xl text-gray-900 dark:text-white">
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
              <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-4">ENCRYPT</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Encrypt your tokens for secure storage</p>
                <Button
                  onClick={() => setShowEncryptDialog(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Encrypt Tokens
                </Button>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-4">SEND</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Send your encrypted tokens</p>
                <Button
                  onClick={() => router.push('/dashboard/send')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Send Tokens
                </Button>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-4">DECRYPT</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">View and decrypt received tokens</p>
                <Button
                  onClick={() => router.push('/dashboard/decrypt')}
                  className="w-full"
                >
                  Manage Encrypted
                </Button>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="col-span-2 p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {recentTransactions.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                ) : (
                  <div className="grid gap-4 pr-2">
                    {recentTransactions.map((tx: TransactionDisplayProps) => (
                      <div
                        key={tx.id}
                        className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                tx.type === 'Encrypt' ? 'bg-blue-900 text-blue-200' :
                                tx.type === 'Send' ? 'bg-purple-900 text-purple-200' :
                                tx.type === 'Receive' ? 'bg-green-900 text-green-200' :
                                'bg-yellow-900 text-yellow-200'
                              }`}>
                                {tx.type}
                              </span>
                              <h3 className="font-medium">{tx.tokenType}</h3>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Amount: {formatBalance(tx.amount, SUPPORTED_TOKENS[tx.tokenType]?.decimals || 9)}
                            </p>
                            {tx.type !== 'Encrypt' && tx.sender && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {tx.type === 'Send' ? 'To: ' : 'From: '}
                                <span className="font-mono">
                                  {(tx.type === 'Send' ? tx.recipient : tx.sender)?.slice(0, 8)}...
                                  {(tx.type === 'Send' ? tx.recipient : tx.sender)?.slice(-6)}
                            </span>
                              </p>
                            )}
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(tx.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              tx.status === 'locked' ? 'bg-blue-900 text-blue-200' :
                              tx.status === 'sent' ? 'bg-purple-900 text-purple-200' :
                              tx.status === 'received' ? 'bg-green-900 text-green-200' :
                              tx.status === 'decrypted' ? 'bg-yellow-900 text-yellow-200' :
                              'bg-gray-900 text-gray-200'
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
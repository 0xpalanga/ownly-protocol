"use client";
import { db } from "../../firebase.js";
import { collection, query, where, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, orderBy, limit } from "firebase/firestore";
import { getAuth, signInWithCustomToken, onAuthStateChanged, User } from "firebase/auth";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConnectButton } from '@mysten/dapp-kit';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CryptoJS from "crypto-js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { useSignPersonalMessage, useCurrentAccount, useWallets, useConnectWallet, useSuiClient } from "@mysten/dapp-kit";


const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "secondary" | "destructive" | "outline" }) => {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const variantClasses = {
    default: "bg-blue-100 text-blue-800",
    secondary: "bg-gray-100 text-gray-800",
    destructive: "bg-red-100 text-red-800",
    outline: "border border-gray-300 text-gray-700"
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};

// Type definitions
interface EncryptedTokenData {
  id?: string;
  tokenType: string;
  amount: number;
  sender: string;
  owner?: string;
  encryptedData?: string;
  timestamp: any;
  status: 'encrypted' | 'sent' | 'received' | 'decrypted';
}

interface ReceivedToken {
  id: string;
  encryptedData: string;
  tokenType: string;
  amount: number;
  sender: string;
  recipient: string;
  timestamp: any;
  status: 'pending' | 'decrypted';
  decryptedAt?: any;
}

interface WalletBalance {
  [tokenType: string]: number;
}

export default function DashboardPage() {
  // Hooks
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const client = useSuiClient();
  const router = useRouter();
  const account = useCurrentAccount();
  const { wallets } = useWallets();
  const { connect } = useConnectWallet();
  const auth = getAuth();
  
  // State
  const [balance, setBalance] = useState("0");
  const [walletBalances, setWalletBalances] = useState<WalletBalance>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Token states
  const [myEncryptedTokens, setMyEncryptedTokens] = useState<EncryptedTokenData[]>([]);
  const [receivedTokens, setReceivedTokens] = useState<ReceivedToken[]>([]);
  const [sentTokens, setSentTokens] = useState<ReceivedToken[]>([]);
  
  // Modal states
  const [encryptModalOpen, setEncryptModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [decryptModalOpen, setDecryptModalOpen] = useState(false);
  
  // Form states
  const [encryptToken, setEncryptToken] = useState("SUI");
  const [encryptAmount, setEncryptAmount] = useState("");
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendToken, setSendToken] = useState("SUI");
  const [sendAmount, setSendAmount] = useState("");
  const [selectedTokenForDecrypt, setSelectedTokenForDecrypt] = useState<ReceivedToken | null>(null);

  const connected = !!account;
  const currentAddress = account?.address;

  // Utility Functions
  const showMessage = (message: string, type: 'success' | 'error' = 'success') => {
    alert(message); // Replace with proper toast notification
  };

  const validateAddress = (address: string): boolean => {
    return address.startsWith('0x') && address.length === 66;
  };

  const validateAmount = (amount: string): boolean => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  };

  // Simplified authentication (since you don't have backend yet)
  const authenticateUser = async () => {
    if (!currentAddress) {
      showMessage("Please connect your wallet first", 'error');
      return false;
    }

    try {
      // Create a message to sign for authentication
      const timestamp = Date.now();
      const message = `Authenticate wallet ${currentAddress} at ${timestamp}`;
      const encoded = new TextEncoder().encode(message);
      
      // Sign the message
      const signature = await signPersonalMessage({ message: encoded });
      
      //simulate authentication without backend
      console.log("Wallet signature verified:", signature);
      
      // Simulate successful authentication
      setIsAuthenticated(true);
      setFirebaseUser({ uid: currentAddress } as User);
      
      return true;
    } catch (error) {
      console.error("Authentication failed:", error);
      showMessage("Authentication failed", 'error');
      return false;
    }
  };

  // Monitor Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe();
  }, [auth]);

  // Fetch user's encrypted tokens (tokens they created)
  const fetchMyEncryptedTokens = async () => {
    if (!currentAddress || !isAuthenticated) return;
    
    try {
      const q = query(
        collection(db, "encrypted_tokens"),
        where("sender", "==", currentAddress),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const tokens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EncryptedTokenData));
      
      setMyEncryptedTokens(tokens);
    } catch (error) {
      console.error("Error fetching encrypted tokens:", error);
      showMessage("Failed to fetch encrypted tokens. Please check your authentication.", 'error');
    }
  };

  // Fetch tokens received from others
  const fetchReceivedTokens = async () => {
    if (!currentAddress || !isAuthenticated) return;
    
    try {
      const q = query(
        collection(db, "sent_tokens"),
        where("recipient", "==", currentAddress),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const tokens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReceivedToken));
      
      setReceivedTokens(tokens);
    } catch (error) {
      console.error("Error fetching received tokens:", error);
      showMessage("Failed to fetch received tokens. Please check your authentication.", 'error');
    }
  };

  // Fetch tokens sent to others
  const fetchSentTokens = async () => {
    if (!currentAddress || !isAuthenticated) return;
    
    try {
      const q = query(
        collection(db, "sent_tokens"),
        where("sender", "==", currentAddress),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const tokens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReceivedToken));
      
      setSentTokens(tokens);
    } catch (error) {
      console.error("Error fetching sent tokens:", error);
      showMessage("Failed to fetch sent tokens. Please check your authentication.", 'error');
    }
  };

  // Fetch SUI balance from blockchain
  const fetchBalance = async (address: string) => {
    if (!address) return;
    
    try {
      const { totalBalance } = await client.getBalance({ owner: address });
      const suiAmount = parseFloat(totalBalance) / 1e9;
      setBalance(suiAmount.toFixed(4));
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance("0");
    }
  };

  // Calculate wallet balances from decrypted tokens
  const calculateWalletBalances = () => {
    const balances: WalletBalance = {};
    
    // Add balances from decrypted received tokens
    receivedTokens
      .filter(token => token.status === 'decrypted')
      .forEach(token => {
        balances[token.tokenType] = (balances[token.tokenType] || 0) + token.amount;
      });
    
    setWalletBalances(balances);
  };

  // Encrypt token function
  const handleEncrypt = async () => {
    if (!validateAmount(encryptAmount)) {
      showMessage("Please enter a valid amount", 'error');
      return;
    }

    if (!currentAddress || !isAuthenticated) {
      showMessage("Please connect your wallet and authenticate", 'error');
      return;
    }

    setLoading(true);
    
    try {
      // Create token data to encrypt
      const tokenData = {
        tokenType: encryptToken,
        amount: parseFloat(encryptAmount),
        timestamp: Date.now(),
        owner: currentAddress
      };
      
      // Encrypt the data using the user's address as key
      const encryptedData = CryptoJS.AES.encrypt(
        JSON.stringify(tokenData), 
        currentAddress
      ).toString();
      
      const tokenDoc = {
        sender: currentAddress,
        tokenType: encryptToken,
        amount: parseFloat(encryptAmount),
        encryptedData: encryptedData,
        timestamp: serverTimestamp(),
        status: 'encrypted'
      };

      await addDoc(collection(db, "encrypted_tokens"), tokenDoc);
      showMessage("Token encrypted and stored successfully!");
      
      setEncryptModalOpen(false);
      setEncryptAmount("");
      setEncryptToken("SUI");
      
      // Refresh tokens
      await fetchMyEncryptedTokens();
    } catch (error) {
      console.error("Error encrypting token:", error);
      showMessage("Failed to encrypt token. Please check your authentication.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Send encrypted token to another user
  const handleSend = async () => {
    if (!validateAddress(sendRecipient)) {
      showMessage("Please enter a valid recipient address", 'error');
      return;
    }

    if (!validateAmount(sendAmount)) {
      showMessage("Please enter a valid amount", 'error');
      return;
    }

    if (!currentAddress || !isAuthenticated) {
      showMessage("Please connect your wallet and authenticate", 'error');
      return;
    }

    if (sendRecipient === currentAddress) {
      showMessage("Cannot send token to yourself", 'error');
      return;
    }

    setLoading(true);

    try {
      // Create token data
      const tokenData = {
        tokenType: sendToken,
        amount: parseFloat(sendAmount),
        sender: currentAddress,
        timestamp: Date.now()
      };

      // Encrypt using recipient's address as key (they can decrypt with their address)
      const encryptedData = CryptoJS.AES.encrypt(
        JSON.stringify(tokenData), 
        sendRecipient
      ).toString();

      // Store in sent_tokens collection
      const sentTokenDoc = {
        sender: currentAddress,
        recipient: sendRecipient,
        tokenType: sendToken,
        amount: parseFloat(sendAmount),
        encryptedData: encryptedData,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(db, "sent_tokens"), sentTokenDoc);
      showMessage(`Successfully sent ${sendAmount} ${sendToken} to ${sendRecipient}`);

      setSendModalOpen(false);
      setSendRecipient("");
      setSendToken("SUI");
      setSendAmount("");
      
      // Refresh tokens
      await fetchSentTokens();
      await fetchReceivedTokens();
    } catch (error) {
      console.error("Error sending token:", error);
      showMessage("Failed to send token. Please check your authentication.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Decrypt received token
  const handleDecrypt = async (token: ReceivedToken) => {
    if (!currentAddress || !isAuthenticated) {
      showMessage("Please connect your wallet and authenticate", 'error');
      return;
    }

    setLoading(true);

    try {
      // Decrypt using current user's address as key
      const bytes = CryptoJS.AES.decrypt(token.encryptedData, currentAddress);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedData) {
        showMessage("Failed to decrypt token - invalid key", 'error');
        return;
      }

      const tokenData = JSON.parse(decryptedData);
      
      // Update token status to decrypted
      const tokenRef = doc(db, "sent_tokens", token.id);
      await updateDoc(tokenRef, {
        status: 'decrypted',
        decryptedAt: serverTimestamp()
      });

      showMessage(`Successfully decrypted ${tokenData.amount} ${tokenData.tokenType}!`);
      
      // Refresh tokens and balances
      await fetchReceivedTokens();
      calculateWalletBalances();
      
      setDecryptModalOpen(false);
      setSelectedTokenForDecrypt(null);
    } catch (error) {
      console.error("Error decrypting token:", error);
      showMessage("Failed to decrypt token. Please check your authentication.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Main effect for wallet connection and authentication
  useEffect(() => {
    if (connected && currentAddress) {
      // First authenticate, then fetch data
      authenticateUser().then((authenticated) => {
        if (authenticated) {
          fetchBalance(currentAddress);
          // Small delay to ensure authentication is set
          setTimeout(() => {
            fetchMyEncryptedTokens();
            fetchReceivedTokens();
            fetchSentTokens();
          }, 100);
        }
      });
    } else {
      setIsAuthenticated(false);
      setFirebaseUser(null);
      // Clear data when disconnected
      setMyEncryptedTokens([]);
      setReceivedTokens([]);
      setSentTokens([]);
      setWalletBalances({});
    }
  }, [connected, currentAddress]);

  useEffect(() => {
    calculateWalletBalances();
  }, [receivedTokens]);

  // Auto-refresh tokens every 30 seconds (only if authenticated)
  useEffect(() => {
    if (!currentAddress || !isAuthenticated) return;
    
    const interval = setInterval(() => {
      fetchReceivedTokens();
      fetchSentTokens();
      fetchMyEncryptedTokens();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentAddress, isAuthenticated]);

  if (!connected) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Ownly Protocol</h1>
          <p className="text-gray-400">Please connect your wallet to continue</p>
          <ConnectButton />
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

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <nav className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-gray-900 shadow gap-4 md:gap-0">
        <div className="text-xl font-bold">Ownly Protocol</div>
        <div className="flex flex-col md:flex-row md:items-center w-full md:w-auto justify-between gap-4">
          <div className="flex justify-center md:justify-start gap-20">
            {["account", "received", "sent", "history"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium transition-colors ${
                  activeTab === tab ? "text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex justify-center md:justify-end gap-4">
            <ConnectButton />
            <Button
              variant="destructive"
              onClick={() => {
                setIsAuthenticated(false);
                setFirebaseUser(null);
                router.push("/");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        {activeTab === "account" && (
          <section className="space-y-10">
            <div>
              <h1 className="text-4xl font-bold">Welcome to Your Dashboard</h1>
              <p className="text-gray-400 mt-2">Manage your encrypted tokens securely</p>
              {isAuthenticated && (
                <p className="text-green-400 text-sm mt-1">✓ Wallet authenticated</p>
              )}
            </div>

            <div className="bg-gray-900 p-6 rounded-xl shadow-md space-y-6">
              <h2 className="text-2xl font-semibold">Account Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-4 rounded">
                  <h3 className="text-sm text-gray-400">SUI Balance</h3>
                  <p className="text-xl font-semibold">{balance} SUI</p>
                </div>
                <div className="bg-gray-800 p-4 rounded">
                  <h3 className="text-sm text-gray-400">Pending Tokens</h3>
                  <p className="text-xl font-semibold">{receivedTokens.filter(t => t.status === 'pending').length}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded space-y-2">
                  <h3 className="text-sm text-gray-400">Wallet Address</h3>
                  <p className="text-sm break-words">{currentAddress}</p>
                  <Button
                    size="sm"
                    className="w-full bg-gray-600 text-white hover:bg-gray-500"
                    onClick={() => {
                      navigator.clipboard.writeText(currentAddress || '');
                      showMessage("Address copied!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {/* Decrypted Token Balances */}
              {Object.keys(walletBalances).length > 0 && (
                <div className="bg-gray-800 p-4 rounded">
                  <h3 className="text-lg font-semibold mb-3">Decrypted Token Balances</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(walletBalances).map(([token, amount]) => (
                      <div key={token} className="bg-gray-700 p-3 rounded">
                        <p className="text-sm text-gray-300">{token}</p>
                        <p className="text-lg font-semibold">{amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-4">
                {/* Encrypt Modal */}
                <Dialog open={encryptModalOpen} onOpenChange={setEncryptModalOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={loading}>
                      {loading ? "Processing..." : "Encrypt Token"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Encrypt Token</DialogTitle>
                      <DialogDescription>
                        Create an encrypted token that only you can decrypt.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="token">Token Type</Label>
                        <Input
                          id="token"
                          value={encryptToken}
                          onChange={(e) => setEncryptToken(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="Enter amount"
                          value={encryptAmount}
                          onChange={(e) => setEncryptAmount(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleEncrypt} disabled={loading}>
                        {loading ? "Encrypting..." : "Encrypt Now"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Send Modal */}
                <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={loading}>
                      {loading ? "Processing..." : "Send Token"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Encrypted Token</DialogTitle>
                      <DialogDescription>
                        Send an encrypted token to another wallet address.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="recipient">Recipient Address</Label>
                        <Input
                          id="recipient"
                          placeholder="0x..."
                          value={sendRecipient}
                          onChange={(e) => setSendRecipient(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="send-token">Token Type</Label>
                        <Input
                          id="send-token"
                          placeholder="e.g., SUI"
                          value={sendToken}
                          onChange={(e) => setSendToken(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="send-amount">Amount</Label>
                        <Input
                          id="send-amount"
                          type="number"
                          placeholder="Enter amount"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleSend} disabled={loading}>
                        {loading ? "Sending..." : "Send Now"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* My Encrypted Tokens */}
            <div className="bg-gray-900 p-6 rounded-xl shadow-md space-y-4">
              <h2 className="text-2xl font-semibold">My Encrypted Tokens</h2>
              <div className="space-y-2">
                {myEncryptedTokens.length === 0 ? (
                  <p className="text-gray-500">No encrypted tokens yet</p>
                ) : (
                  myEncryptedTokens.map((token, idx) => (
                    <div key={idx} className="bg-gray-800 p-4 rounded flex justify-between items-center">
                      <div>
                        <p><strong>Type:</strong> {token.tokenType}</p>
                        <p><strong>Amount:</strong> {token.amount}</p>
                        <Badge variant="secondary">{token.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "received" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Received Tokens</h2>
            <div className="bg-gray-900 p-6 rounded-xl shadow-md">
              <div className="space-y-4">
                {receivedTokens.length === 0 ? (
                  <p className="text-gray-500">No tokens received yet</p>
                ) : (
                  receivedTokens.map((token) => (
                    <div key={token.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
                      <div>
                        <p><strong>From:</strong> {token.sender}</p>
                        <p><strong>Type:</strong> {token.tokenType}</p>
                        <p><strong>Amount:</strong> {token.amount}</p>
                        <Badge variant={token.status === 'pending' ? 'destructive' : 'default'}>
                          {token.status}
                        </Badge>
                      </div>
                      {token.status === 'pending' && (
                        <Button
                          onClick={() => handleDecrypt(token)}
                          disabled={loading}
                        >
                          {loading ? "Decrypting..." : "Decrypt"}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "sent" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Sent Tokens</h2>
            <div className="bg-gray-900 p-6 rounded-xl shadow-md">
              <div className="space-y-4">
                {sentTokens.length === 0 ? (
                  <p className="text-gray-500">No tokens sent yet</p>
                ) : (
                  sentTokens.map((token) => (
                    <div key={token.id} className="bg-gray-800 p-4 rounded">
                      <p><strong>To:</strong> {token.recipient}</p>
                      <p><strong>Type:</strong> {token.tokenType}</p>
                      <p><strong>Amount:</strong> {token.amount}</p>
                      <Badge variant={token.status === 'pending' ? 'secondary' : 'default'}>
                        {token.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Transaction History</h2>
            <div className="bg-gray-900 p-6 rounded-xl shadow-md space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3">All Activities</h3>
                <div className="space-y-2">
                  {[...myEncryptedTokens, ...receivedTokens, ...sentTokens].length === 0 ? (
                    <p className="text-gray-500">No activities yet</p>
                  ) : (
                    [...myEncryptedTokens, ...receivedTokens, ...sentTokens]
                      .sort((a, b) => {
                        const timeA = a.timestamp?.seconds || 0;
                        const timeB = b.timestamp?.seconds || 0;
                        return timeB - timeA;
                      })
                      .map((item, i) => (
                        <div key={i} className="p-4 bg-gray-800 rounded">
                          <div className="flex justify-between items-center">
                            <div>
                              <p><strong>{item.tokenType}</strong> - {item.amount}</p>
                              <p className="text-sm text-gray-400">
                                {'recipient' in item ? `To: ${item.recipient}` : 
                                 'sender' in item && item.sender !== currentAddress ? `From: ${item.sender}` : 
                                 'My encrypted token'}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {'status' in item ? item.status : 'encrypted'}
                            </Badge>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
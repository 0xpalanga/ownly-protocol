//app/internal-wallet/page.tsx

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from '@/components/ui/card';
import Cookies from 'js-cookie';

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import CryptoJS from "crypto-js";
import { signInAnonymously, signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { BIP39_WORDS } from "./bip39_words";


interface WalletData {
  address: string;
  publicKey: string;
  privateKeyEncrypted: string;
  mnemonic?: string; // Only stored temporarily during creation
}


// Utility functions for wallet generation
class WalletUtils {
  
  // Generate cryptographically secure random bytes
  static generateSecureRandom(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  // Generate a proper BIP39-style mnemonic 
  static generateMnemonic(): string {
    const entropy = this.generateSecureRandom(16); 
    const words: string[] = [];

    // Convert entropy to mnemonic words 
    for (let i = 0; i < 12; i++) {
      const index = entropy[i] % BIP39_WORDS.length;
      words.push(BIP39_WORDS[index]);
    }

    return words.join(" ");
  }

  // Derive seed from mnemonic 
  static mnemonicToSeed(mnemonic: string, passphrase: string = ""): Uint8Array {
    const salt = "mnemonic" + passphrase;
    const key = CryptoJS.PBKDF2(mnemonic, salt, {
      keySize: 64 / 4, 
      iterations: 2048
    });

    // Convert WordArray to Uint8Array
    const words = key.words;
    const bytes = new Uint8Array(64);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      bytes[i * 4] = (word >>> 24) & 0xff;
      bytes[i * 4 + 1] = (word >>> 16) & 0xff;
      bytes[i * 4 + 2] = (word >>> 8) & 0xff;
      bytes[i * 4 + 3] = word & 0xff;
    }

    return bytes.slice(0, 32); 
  }

  // Create keypair from seed
  static createKeypairFromSeed(seed: Uint8Array): Ed25519Keypair {
    return Ed25519Keypair.fromSecretKey(seed);
  }

  // Validate mnemonic format
  static validateMnemonic(mnemonic: string): boolean {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) return false;

    // Check if all words are in our word list 
    return words.every(word => BIP39_WORDS.includes(word.toLowerCase()));
  }

  // Encrypt private key with password
  static encryptPrivateKey(privateKey: Uint8Array, password: string): string {
    const privateKeyB64 = toBase64(privateKey);
    return CryptoJS.AES.encrypt(privateKeyB64, password).toString();
  }

  // Decrypt private key with password
  static decryptPrivateKey(encryptedPrivateKey: string, password: string): Uint8Array {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password);
    const privateKeyB64 = bytes.toString(CryptoJS.enc.Utf8);
    return fromBase64(privateKeyB64);
  }

  // Create wallet from mnemonic
  static createWalletFromMnemonic(mnemonic: string, password: string): WalletData {
    const seed = this.mnemonicToSeed(mnemonic);
    const keypair = this.createKeypairFromSeed(seed);

    const address = keypair.getPublicKey().toSuiAddress();
    const publicKey = toBase64(keypair.getPublicKey().toSuiBytes());
    const privateKeyEncrypted = this.encryptPrivateKey(keypair.getSecretKey(), password);

    return {
      address,
      publicKey,
      privateKeyEncrypted
    };
  }
}
const generateSignMessage = (walletAddress: string): string => {
  return `Sign this message to authenticate with Ownly: ${walletAddress}`;
};


export default function InternalWalletPage() {
  const [step, setStep] = useState<"choose" | "create" | "import" | "password" | "confirm">("choose");
  const [mnemonic, setMnemonic] = useState("");
  const [inputMnemonic, setInputMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [address, setAddress] = useState('');

  const router = useRouter();

  const signIntoFirebaseWithWallet = async (walletAddress: string) => {
    
    try {
     //let signin as anon
      await signInAnonymously(auth);
      // Optionally: Store walletAddress in Firestore as part of the user profile
    } catch (err) {
      setError("Failed to authenticate with Firebase");
      console.error("Firebase sign-in error:", err);
    }
  };
  // Generate mnemonic when creating new wallet
  useEffect(() => {
    if (step === "create" && !mnemonic) {
      try {
        const newMnemonic = WalletUtils.generateMnemonic();
        setMnemonic(newMnemonic);
      } catch (err) {
        setError("Failed to generate mnemonic. Please try again.");
      }
    }
  }, [step, mnemonic]);

  const handleCreateWallet = () => {
    setStep("password");
  };

  const handleImportWallet = () => {
    setError("");
    
    if (!WalletUtils.validateMnemonic(inputMnemonic)) {
      setError("Please enter a valid 12-word mnemonic phrase");
      return;
    }
    
    setMnemonic(inputMnemonic.trim());
    setStep("password");
  };

  const handleSetPassword = () => {
    setError("");
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      // Create wallet data from mnemonic
      const wallet = WalletUtils.createWalletFromMnemonic(mnemonic, password);
      setWalletData(wallet);
      setStep("confirm");
    } catch (err) {
      setError("Failed to create wallet. Please try again.");
      console.error("Wallet creation error:", err);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!walletData) return;

    setIsCreating(true);
    setError("");

    try {
      // Store encrypted wallet data securely
      const walletStorage = {
        address: walletData.address,
        publicKey: walletData.publicKey,
        privateKeyEncrypted: walletData.privateKeyEncrypted,
        createdAt: new Date().toISOString()
      };

      // Save to localStorage
      localStorage.setItem("ownly_internal_wallet", JSON.stringify(walletStorage));
      localStorage.setItem("ownly_wallet_exists", "true");

      // Set cookies for authentication
      Cookies.set('internal_wallet_connected', 'true', { path: '/' });
      Cookies.set('internal_wallet_address', walletData.address, { path: '/' });

      // Authenticate with Firebase as anon
      await signInAnonymously(auth);

      // Clear sensitive data
      setMnemonic("");
      setPassword("");
      setConfirmPassword("");
      setWalletData(null);

      // Redirect to dashboard since we're now authenticated
      router.push("/dashboard");
    } catch (err) {
      setError("Failed to save wallet or authenticate. Please try again.");
      console.error("Wallet save/auth error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleConnect = () => {
    if (!address) return;

    // Set the internal wallet cookie
    Cookies.set('internal_wallet_connected', 'true', { path: '/' });
    Cookies.set('internal_wallet_address', address, { path: '/' });

    // Redirect to dashboard
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      <div className="bg-gray-900 p-6 rounded-xl shadow-lg w-full max-w-md space-y-6">
        
       
        {step === "choose" && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">Ownly Internal Wallet</h1>
              <p className="text-gray-400 text-sm">
                Create a secure wallet for the Ownly Protocol
              </p>
            </div>
            
            <div className="space-y-4">
              <Button 
                className="w-full h-12" 
                onClick={() => setStep("create")}
              >
                Create New Wallet
              </Button>
              <Button 
                className="w-full h-12" 
                variant="outline" 
                onClick={() => setStep("import")}
              >
                Import Existing Wallet
              </Button>
            </div>
          </>
        )}

       
        {step === "create" && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Recovery Phrase</h2>
              <p className="text-gray-400 text-sm">
                Write down these 12 words in order. You'll need them to recover your wallet.
              </p>
            </div>
            
            {mnemonic && (
              <div className="bg-gray-800 p-4 rounded-lg border-2 border-yellow-500/20">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {mnemonic.split(" ").map((word, index) => (
                    <div key={index} className="bg-gray-700 p-2 rounded text-sm">
                      <span className="text-gray-400 text-xs">{index + 1}.</span>
                      <br />
                      <span className="font-medium">{word}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => copyToClipboard(mnemonic)}
              >
                Copy Recovery Phrase
              </Button>
              <Button 
                className="w-full" 
                onClick={handleCreateWallet}
              >
                I've Saved My Recovery Phrase
              </Button>
            </div>
            
           ⚠️ Never share your recovery phrase. Anyone with access to it can control your wallet.
          </>
        )}

 
        {step === "import" && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Import Wallet</h2>
              <p className="text-gray-400 text-sm">
                Enter your 12-word recovery phrase to import your wallet.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mnemonic">Recovery Phrase</Label>
                <textarea
                  id="mnemonic"
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 min-h-[100px] resize-none"
                  placeholder="Enter your 12-word recovery phrase..."
                  value={inputMnemonic}
                  onChange={(e) => setInputMnemonic(e.target.value)}
                />
              </div>
              
              
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setStep("choose");
                    setError("");
                    setInputMnemonic("");
                  }}
                >
                  Back
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleImportWallet}
                >
                  Continue
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Set Password */}
        {step === "password" && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Secure Your Wallet</h2>
              <p className="text-gray-400 text-sm">
                Create a strong password to encrypt your wallet.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              
              
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setStep(mnemonic === inputMnemonic.trim() ? "import" : "create");
                    setError("");
                    setPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Back
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSetPassword}
                >
                  Create Wallet
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "confirm" && walletData && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Wallet Created Successfully!</h2>
              <p className="text-gray-400 text-sm">
                Your wallet has been generated. Please verify the details below.
              </p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg space-y-3">
              <div>
                <Label className="text-gray-300">Wallet Address</Label>
                <div className="bg-gray-700 p-2 rounded mt-1 break-all text-sm font-mono">
                  {walletData.address}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copyToClipboard(walletData.address)}
              >
                Copy Address
              </Button>
            </div>
            
            ✅ Your wallet is encrypted and will be stored securely. You'll need your password to access it.
            
            <Button 
              className="w-full h-12" 
              onClick={handleConfirmAndSave}
              disabled={isCreating}
            >
              {isCreating ? "Saving Wallet..." : "Complete Setup"}
            </Button>
            
            {error && (
              <div className="text-red-500 text-sm mt-2">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
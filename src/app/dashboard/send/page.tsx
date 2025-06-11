"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  getEncryptedTokensByStatus, 
  SUPPORTED_TOKENS, 
  buildTransferTokenTransaction,
  EncryptedTokenData 
} from '@/lib/tokens';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { saveEncryptedToken } from '@/lib/tokens';
import { BackButton } from '@/components/BackButton';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

// Add formatBalance function
const formatBalance = (balance: string, decimals: number = 9): string => {
  try {
    if (!balance) return '0.0000';
    
    // If the balance is already in decimal format
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

    // If the balance is in smallest unit format
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

interface EncryptedToken {
  id: string;
  txDigest: string;
  token: string;
  amount: string;
  status: 'locked' | 'sent' | 'received' | 'decrypted';
  timestamp: number;
  encryptedData: string;
  encryptionKey: string;
  sender: string;
  recipient?: string;
  lockObjectId: string;
}

// Add this CSS at the top of the file, after the imports:
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

export default function SendPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [selectedToken, setSelectedToken] = useState<EncryptedToken | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [encryptedTokens, setEncryptedTokens] = useState<EncryptedToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [decryptedTokenIds, setDecryptedTokenIds] = useState<Set<string>>(new Set());
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Load decrypted token IDs from localStorage on mount
  useEffect(() => {
    if (account) {
      const storedIds = localStorage.getItem(`decrypted_tokens_${account.address}`);
      if (storedIds) {
        setDecryptedTokenIds(new Set(JSON.parse(storedIds)));
      }
    }
  }, [account]);

  useEffect(() => {
    if (!account) {
      router.push('/');
      return;
    }

    // Load encrypted tokens and set selected token if ID is in URL
    const tokenId = searchParams.get('id');
    fetchEncryptedTokens(tokenId);
  }, [account, searchParams]);

  // Add the styles to the page
  useEffect(() => {
    // Add the styles to the document
    const styleElement = document.createElement('style');
    styleElement.textContent = scrollbarStyles;
    document.head.appendChild(styleElement);

    // Cleanup
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const fetchEncryptedTokens = async (tokenId?: string | null) => {
    if (!account) return;
    
    try {
      setError(null);
      // Fetch only locked tokens that can be sent
      const tokens = await getEncryptedTokensByStatus('locked', account.address);
      console.log('Fetched tokens:', tokens);
      
      // Format tokens for display and filter out decrypted or sent ones
      const formattedTokens = tokens
        .filter(token => {
          // Filter out tokens that:
          // 1. Are in decryptedTokenIds
          // 2. Don't have a lockObjectId
          // 3. Are not in 'locked' status
          const id = token.id || token.txDigest;
          return !decryptedTokenIds.has(id) && 
                 token.status === 'locked' && 
                 token.lockObjectId && 
                 token.lockObjectId.length > 0;
        })
        .map(token => ({
          id: token.id || token.txDigest,
          txDigest: token.txDigest,
          token: token.token,
          amount: token.amount,
          status: 'locked' as const,
          timestamp: token.timestamp,
          encryptedData: token.encryptedData,
          encryptionKey: token.encryptionKey,
          sender: token.sender,
          lockObjectId: token.lockObjectId
        }));

      console.log('Formatted tokens:', formattedTokens);
      setEncryptedTokens(formattedTokens);
      
      if (tokenId) {
        const token = formattedTokens.find(t => t.id === tokenId);
        if (token) {
          setSelectedToken(token);
          setShowSendDialog(true);
        }
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError('Failed to fetch encrypted tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add an effect to refresh the token list when decryptedTokenIds changes
  useEffect(() => {
    if (account) {
      fetchEncryptedTokens();
    }
  }, [account, decryptedTokenIds]);

  const handleSend = async () => {
    if (!selectedToken || !recipientAddress || !account) return;

    try {
      setError(null);
      setSuccess(null);
      setIsSending(true);
      
      // Validate recipient address
      if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 66) {
        throw new Error('Invalid recipient address format');
      }

      // Validate lockObjectId
      if (!selectedToken.lockObjectId || selectedToken.lockObjectId.length === 0) {
        throw new Error('Lock object ID not found. This token may have been already decrypted or sent.');
      }

      // Create a new record for the recipient first
      const receivedToken: EncryptedTokenData = {
        id: `${selectedToken.txDigest}-${Date.now()}`, // Ensure unique ID
        txDigest: selectedToken.txDigest,
        token: selectedToken.token,
        amount: selectedToken.amount,
        encryptedData: selectedToken.encryptedData,
        encryptionKey: selectedToken.encryptionKey,
        sender: account.address,
        recipient: recipientAddress,
        status: 'received',
        timestamp: Date.now(),
        lockObjectId: selectedToken.lockObjectId
      };

      // Save the received token record first
      await saveEncryptedToken(receivedToken);

      // Update the sender's token status
      const tokenRef = doc(db, 'encryptedTokens', selectedToken.id);
      await updateDoc(tokenRef, {
        status: 'sent',
        recipient: recipientAddress,
        sentAt: Date.now()
      });

      // After successful database updates, build and execute the transfer transaction
      const tx = buildTransferTokenTransaction(
        recipientAddress,
        BigInt(selectedToken.amount),
        SUPPORTED_TOKENS[selectedToken.token]
      );

      tx.setSender(account.address);
      
      // Properly serialize and encode the transaction
      const bytes = await tx.build({ 
        client: new SuiClient({ url: getFullnodeUrl('testnet') })
      });
      const serializedTx = btoa(String.fromCharCode(...bytes));

      const result = await signAndExecute({
        transaction: serializedTx
      });

      if (!result) {
        throw new Error('Transaction failed');
      }

      // After successful send, update the local state immediately
      setEncryptedTokens(prev => prev.filter(t => t.id !== selectedToken.id));
      setSelectedToken(null);
      setRecipientAddress('');
      setShowSendDialog(false);
      setSuccess('Token sent successfully! Redirecting to dashboard...');

      // Redirect back to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Send failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to send token. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!account) {
    return null;
  }

    return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <BackButton />
        <h1 className="text-3xl font-bold mt-4 mb-2">Send Encrypted Tokens</h1>
        <p className="text-gray-400">Transfer your encrypted tokens to another address securely</p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-900 border-green-800">
          <AlertDescription className="text-green-200">{success}</AlertDescription>
        </Alert>
      )}
      
      <Card className="p-6 bg-gray-800/50 border-gray-700 backdrop-blur-sm">
        <h2 className="text-xl font-semibold mb-4">Select Token to Send</h2>
        <div className="space-y-4">
          {isLoading ? (
          <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full bg-gray-700" />
              ))}
            </div>
          ) : encryptedTokens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No encrypted tokens available to send</p>
              <Button onClick={() => router.push('/dashboard')} variant="outline">
                Return to Dashboard
              </Button>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid gap-4">
                {encryptedTokens.map((token) => (
                  <div
                    key={token.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all transform hover:scale-[1.02] ${
                      selectedToken?.id === token.id
                        ? 'bg-blue-900/50 border-blue-700 ring-2 ring-blue-500'
                        : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => {
                      setSelectedToken(token);
                      setShowSendDialog(true);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{token.token}</h3>
                          <Badge variant="secondary" className="bg-blue-900 text-blue-200">
                            {token.status}
                          </Badge>
                        </div>
                        <p className="text-lg font-semibold text-white mb-1">
                          {formatBalance(token.amount, SUPPORTED_TOKENS[token.token]?.decimals || 9)}
                          <span className="text-sm text-gray-400 ml-1">{token.token}</span>
                        </p>
                        <p className="text-sm text-gray-400">
                          Created {new Date(token.timestamp).toLocaleDateString()} at{' '}
                          {new Date(token.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="border-blue-500 text-blue-200">
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}
          </div>
        </Card>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Token</DialogTitle>
            <DialogDescription>
              Enter the recipient's address to send the selected token
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
        {selectedToken && (
              <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium">{selectedToken.token}</h3>
                  <Badge variant="secondary" className="bg-blue-900 text-blue-200">
                    {selectedToken.status}
                  </Badge>
                </div>
                <p className="text-lg font-semibold text-white">
                  {formatBalance(selectedToken.amount, SUPPORTED_TOKENS[selectedToken.token]?.decimals || 9)}
                  <span className="text-sm text-gray-400 ml-1">{selectedToken.token}</span>
                </p>
              </div>
            )}
              <div>
              <Label htmlFor="recipient" className="text-sm font-medium mb-1.5">
                Recipient Address
              </Label>
                <Input
                id="recipient"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter recipient's Sui address (0x...)"
                className="bg-gray-900/50 border-gray-700 h-12"
                />
              <p className="text-sm text-gray-400 mt-2">
                Make sure to double-check the recipient's address before sending
              </p>
              </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSendDialog(false);
                  setRecipientAddress('');
                }}
              >
                Cancel
              </Button>
                <Button
                  onClick={handleSend}
                disabled={!selectedToken || !recipientAddress || isSending}
                className="relative"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Token'
                )}
                </Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
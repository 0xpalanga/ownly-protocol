"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from '@mysten/dapp-kit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  getEncryptedTokensByStatus, 
  SUPPORTED_TOKENS,
  buildUnlockTokenTransaction
} from '@/lib/tokens';
import CryptoJS from 'crypto-js';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { BackButton } from '@/components/BackButton';

interface EncryptedToken {
  id: string;
  txDigest: string;
  token: string;
  amount: string;
  status: string;
  timestamp: number;
  encryptedData: string;
  encryptionKey: string;
  sender: string;
  recipient?: string;
}

// Add formatBalance helper
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

export default function DecryptPage() {
  const [receivedTokens, setReceivedTokens] = useState<EncryptedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransactionBlock();

  useEffect(() => {
    if (!account) {
      router.push('/');
      return;
    }

    fetchReceivedTokens();
  }, [account]);

  const fetchReceivedTokens = async () => {
    if (!account) return;
    
    try {
      setError(null);
      console.log('Fetching tokens for address:', account.address);
      
      // Fetch locked tokens that can be decrypted
      const tokens = await getEncryptedTokensByStatus('locked', account.address);
      console.log('Fetched locked tokens:', tokens);
      
      // Format tokens for display
      const formattedTokens = tokens.map(token => ({
        id: token.id || token.txDigest,
        txDigest: token.txDigest,
        token: token.token,
        amount: token.amount,
        status: token.status,
        timestamp: token.timestamp,
        encryptedData: token.encryptedData,
        encryptionKey: token.encryptionKey,
        sender: token.sender,
        recipient: token.recipient
      }));

      console.log('Formatted tokens:', formattedTokens);
      setReceivedTokens(formattedTokens);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError('Failed to fetch tokens. Please try again.');
    setIsLoading(false);
    }
  };

  const handleDecrypt = async (token: EncryptedToken) => {
    if (!account || isDecrypting) return;

    setIsDecrypting(true);
    setError(null);

    try {
      // Get the lock object ID from the transaction effects
      const client = new SuiClient({ url: getFullnodeUrl('testnet') });
      console.log('Fetching transaction:', token.txDigest);
      
      const txResponse = await client.getTransactionBlock({
        digest: token.txDigest,
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
        },
      });

      console.log('Full transaction response:', JSON.stringify(txResponse, null, 2));

      // Look through all created objects in the transaction
      if (!txResponse.effects?.created || txResponse.effects.created.length === 0) {
        console.error('No created objects found in transaction');
        throw new Error('No created objects found in transaction');
      }

      console.log('Created objects:', JSON.stringify(txResponse.effects.created, null, 2));

      // Try to find the locked token object
      let lockObjectId = null;

      // First try to find it in created objects
      for (const obj of txResponse.effects.created) {
        console.log('Checking object:', JSON.stringify(obj, null, 2));
        if (obj.owner && typeof obj.owner === 'object' && 'Shared' in obj.owner) {
          lockObjectId = obj.reference.objectId;
          console.log('Found potential lock object ID:', lockObjectId);
          break;
        }
      }

      // If not found in created, check object changes
      if (!lockObjectId && txResponse.objectChanges) {
        console.log('Checking object changes:', JSON.stringify(txResponse.objectChanges, null, 2));
        for (const change of txResponse.objectChanges) {
          if (change.type === 'created' && change.owner && typeof change.owner === 'object' && 'Shared' in change.owner) {
            lockObjectId = change.objectId;
            console.log('Found potential lock object ID in changes:', lockObjectId);
            break;
          }
        }
      }

      if (!lockObjectId) {
        console.error('Could not find lock object ID in transaction. Full response:', JSON.stringify(txResponse, null, 2));
        throw new Error('Could not find lock object ID');
      }

      console.log('Using lock object ID:', lockObjectId);

      // Decrypt the token data
      const decryptedBytes = CryptoJS.AES.decrypt(token.encryptedData, token.encryptionKey);
      const decryptedData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
      
      console.log('Decrypted token data:', decryptedData);

      // Get token info
      const tokenInfo = SUPPORTED_TOKENS[token.token];
      if (!tokenInfo) {
        throw new Error('Unsupported token type');
      }

      // Build unlock transaction using the actual wallet address
      const tx = buildUnlockTokenTransaction(
        account.address, // Use actual wallet address
        lockObjectId,
        tokenInfo
      );

      console.log('Built unlock transaction');

      // Sign and execute transaction
      const result = await signAndExecute({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
        },
        requestType: 'WaitForLocalExecution'
      });

      console.log('Transaction result:', result);

      if (result) {
        try {
          // Update the token status in Firebase
          await updateTokenStatus(token.id, 'received', account.address);
          
          // Remove the decrypted token from the list
          setReceivedTokens(prev => prev.filter(t => t.id !== token.id));
          
          // Wait a moment for the blockchain to process the transaction
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          alert('Token successfully decrypted and unlocked!');
          
          // Use replace instead of push to force a fresh load of the dashboard
          router.replace('/dashboard');
        } catch (error) {
          console.error('Error updating token status:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to decrypt token. Please try again.');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Add helper function to update token status
  const updateTokenStatus = async (tokenId: string, newStatus: string, recipient: string) => {
    try {
      const token = receivedTokens.find(t => t.id === tokenId);
      if (!token) return;

      // Update the token status in Firebase
      await fetch('/api/tokens/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId,
          status: newStatus,
          recipient
        }),
      });
    } catch (error) {
      console.error('Error updating token status:', error);
      throw error;
    }
  };

  if (!account) {
    return null; // Will redirect in useEffect
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          Loading tokens...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <BackButton />
      <h1 className="text-2xl font-bold mb-6">Decrypt Received Tokens</h1>
      
      {error && (
        <div className="bg-red-900 text-red-200 p-4 rounded mb-6">
          {error}
        </div>
      )}
      
      <Card className="p-6 bg-gray-800 border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Received Tokens</h2>
        <div className="space-y-4">
          {receivedTokens.length === 0 ? (
            <p className="text-gray-400">No tokens available to decrypt</p>
          ) : (
      <div className="grid gap-4">
              {receivedTokens.map((token) => (
                <div
                  key={token.id}
                  className="p-4 rounded-lg border bg-gray-900 border-gray-700"
                >
                  <div className="flex justify-between items-center">
                <div>
                      <h3 className="font-medium">{token.token}</h3>
                  <p className="text-sm text-gray-400">
                        Amount: {formatBalance(token.amount, SUPPORTED_TOKENS[token.token]?.decimals || 9)}
                  </p>
                  <p className="text-sm text-gray-400">
                        From: {token.sender.slice(0, 8)}...{token.sender.slice(-6)}
                  </p>
                  <p className="text-sm text-gray-400">
                        Received: {new Date(token.timestamp).toLocaleString()}
                  </p>
                </div>
                    <div>
                    <Button
                      onClick={() => handleDecrypt(token)}
                        variant="outline"
                        disabled={isDecrypting}
                    >
                        {isDecrypting ? 'Decrypting...' : 'Decrypt'}
                    </Button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
        )}
      </div>
      </Card>
    </div>
  );
} 
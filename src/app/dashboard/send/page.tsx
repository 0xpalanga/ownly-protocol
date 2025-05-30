"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getEncryptedTokensByStatus, SUPPORTED_TOKENS } from '@/lib/tokens';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { saveEncryptedToken } from '@/lib/tokens';
import { BackButton } from '@/components/BackButton';

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
  status: 'locked' | 'sent' | 'received';
  timestamp: number;
  encryptedData: string;
  encryptionKey: string;
  sender: string;
}

export default function SendPage() {
  const [selectedToken, setSelectedToken] = useState<EncryptedToken | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [encryptedTokens, setEncryptedTokens] = useState<EncryptedToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useCurrentAccount();

  useEffect(() => {
    if (!account) {
      router.push('/');
      return;
    }

    // Load encrypted tokens and set selected token if ID is in URL
    const tokenId = searchParams.get('id');
    fetchEncryptedTokens(tokenId);
  }, [account, searchParams]);

  const fetchEncryptedTokens = async (tokenId?: string | null) => {
    if (!account) return;
    
    try {
      setError(null);
      // Fetch locked tokens that can be sent
      const tokens = await getEncryptedTokensByStatus('locked', account.address);
      console.log('Fetched tokens:', tokens); // Debug log
      
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
        sender: token.sender
      }));

      setEncryptedTokens(formattedTokens);
      
      if (tokenId) {
        const token = formattedTokens.find(t => t.id === tokenId);
        if (token) setSelectedToken(token);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError('Failed to fetch encrypted tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedToken || !recipientAddress || !account) return;

    try {
      setError(null);
      
      // Validate recipient address
      if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 66) {
        throw new Error('Invalid recipient address format');
      }

      // Update token status in Firebase
      const tokenRef = doc(db, 'encryptedTokens', selectedToken.id);
      await updateDoc(tokenRef, {
        status: 'sent',
        recipient: recipientAddress,
        sentAt: Date.now()
      });

      // Create a new record for the recipient
      const receivedToken = {
        txDigest: selectedToken.txDigest,
        token: selectedToken.token,
        amount: selectedToken.amount,
        encryptedData: selectedToken.encryptedData,
        encryptionKey: selectedToken.encryptionKey,
        sender: account.address,
        recipient: recipientAddress,
        status: 'received' as const,
        timestamp: Date.now()
      };

      await saveEncryptedToken(receivedToken);

      // Update UI
      setEncryptedTokens(prev => 
        prev.filter(t => t.id !== selectedToken.id)
      );
      setSelectedToken(null);
      setRecipientAddress('');

      // Redirect back to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Send failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to send token. Please try again.');
    }
  };

  if (!account) {
    return null; // Will redirect in useEffect
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          Loading encrypted tokens...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <BackButton />
      <h1 className="text-2xl font-bold mb-6">Send Encrypted Tokens</h1>
      
      {error && (
        <div className="bg-red-900 text-red-200 p-4 rounded mb-6">
          {error}
        </div>
      )}
      
      <div className="grid gap-6">
        {/* Token Selection */}
        <Card className="p-6 bg-gray-800 border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Select Token to Send</h2>
          <div className="space-y-4">
            {encryptedTokens.length === 0 ? (
              <p className="text-gray-400">No encrypted tokens available to send</p>
            ) : (
              <div className="grid gap-4">
                {encryptedTokens.map((token) => (
                  <div
                    key={token.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedToken?.id === token.id
                        ? 'bg-blue-900 border-blue-700'
                        : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedToken(token)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{token.token}</h3>
                        <p className="text-sm text-gray-400">
                          Amount: {formatBalance(token.amount, SUPPORTED_TOKENS[token.token]?.decimals || 9)}
                        </p>
                        <p className="text-sm text-gray-400">
                          Created: {new Date(token.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-sm">
                        <span className="px-2 py-1 rounded bg-blue-900 text-blue-200">
                          {token.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Recipient Details */}
        <Card className="p-6 bg-gray-800 border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Recipient Details</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter recipient's Sui address"
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!selectedToken || !recipientAddress}
              className="w-full"
            >
              Send Token
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
} 
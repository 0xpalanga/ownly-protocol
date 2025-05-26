"use client";

import { useEffect, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { getEncryptedTokensByStatus, SUPPORTED_TOKENS } from '@/lib/tokens';

interface PlatformTransaction {
  id: string;
  txDigest: string;
  token: string;
  amount: string;
  status: 'locked' | 'sent' | 'received';
  timestamp: number;
  sender: string;
  recipient?: string;
  type?: 'Encrypt' | 'Send' | 'Receive';
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

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const account = useCurrentAccount();

  useEffect(() => {
    const fetchHistory = async () => {
      if (!account) return;
      
      try {
        setError(null);
        
        // Fetch all types of encrypted token transactions
        const [lockedTokens, sentTokens, receivedTokens] = await Promise.all([
          getEncryptedTokensByStatus('locked', account.address),
          getEncryptedTokensByStatus('sent', account.address),
          getEncryptedTokensByStatus('received', account.address)
        ]);

        // Combine all transactions
        const allTransactions = [
          ...lockedTokens.map(token => ({
            ...token,
            type: 'Encrypt' as const
          })),
          ...sentTokens.map(token => ({
            ...token,
            type: 'Send' as const
          })),
          ...receivedTokens.map(token => ({
            ...token,
            type: 'Receive' as const
          }))
        ].sort((a, b) => b.timestamp - a.timestamp);

        setTransactions(allTransactions);
      } catch (error) {
        console.error('Error fetching history:', error);
        setError('Failed to fetch transaction history. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [account]);

  const formatDate = (timestamp: number): string => {
    if (!timestamp || isNaN(timestamp)) return 'Unknown';
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(timestamp));
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  if (!account) {
    return (
      <div className="text-center py-8">
        Please connect your wallet to view your transaction history.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        Loading transaction history...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Transaction History</h1>
      
      {error && (
        <div className="bg-red-900 text-red-200 p-4 rounded mb-6">
          {error}
        </div>
      )}
      
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-700">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id || tx.txDigest}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                    <span className="font-mono">
                      {tx.txDigest.slice(0, 8)}...{tx.txDigest.slice(-6)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tx.type === 'Encrypt' ? 'bg-blue-900 text-blue-200' :
                      tx.type === 'Send' ? 'bg-purple-900 text-purple-200' :
                      'bg-green-900 text-green-200'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                    {tx.token}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                    {formatBalance(tx.amount, SUPPORTED_TOKENS[tx.token]?.decimals || 9)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tx.status === 'locked' ? 'bg-blue-900 text-blue-200' :
                      tx.status === 'sent' ? 'bg-purple-900 text-purple-200' :
                      'bg-green-900 text-green-200'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                    {formatDate(tx.timestamp)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 
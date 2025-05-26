"use client";

import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/button';

export default function ReceivePage() {
  const account = useCurrentAccount();

  const copyToClipboard = () => {
    if (account) {
      navigator.clipboard.writeText(account.address);
      // Add success notification
    }
  };

  if (!account) {
    return (
      <div className="text-center py-8">
        Please connect your wallet to view your receive address.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto text-center">
      <h1 className="text-2xl font-bold mb-6">Receive Tokens</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2">Your Sui Address</p>
          <p className="font-mono bg-gray-900 p-3 rounded break-all">
            {account.address}
          </p>
        </div>
        
        <Button onClick={copyToClipboard} className="w-full">
          Copy Address
        </Button>
      </div>
      
      <p className="mt-4 text-sm text-gray-400">
        Share this address to receive tokens on the Sui network
      </p>
    </div>
  );
} 
"use client";

import { useEffect, useState } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function AccountPage() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      disconnect();
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (!account) {
    return (
      <div className="text-center py-8">
        Please connect your wallet to view your account details.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
      
      <Card className="bg-gray-800 border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Wallet Details</h2>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">Connected Address</p>
            <p className="font-mono bg-gray-900 p-2 rounded mt-1 break-all">
              {account.address}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-400">Network</p>
            <p className="font-medium">Sui Testnet</p>
          </div>
        </div>
      </Card>
      
      <Card className="bg-gray-800 border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Security</h2>
        
        <div className="space-y-4">
          <div>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              Disconnect Wallet & Logout
            </Button>
          </div>
          
          <p className="text-sm text-gray-400">
            Logging out will disconnect your wallet and sign you out of your account.
          </p>
        </div>
      </Card>
    </div>
  );
} 
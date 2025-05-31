"use client";

import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import dynamic from 'next/dynamic';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Set up network configuration
const networks = {
  testnet: { url: getFullnodeUrl("testnet") },
};

// Dynamically import WalletProvider with no SSR
const DynamicWalletProvider = dynamic(
  () => import('@mysten/dapp-kit').then((mod) => mod.WalletProvider),
  { ssr: false }
);

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <DynamicWalletProvider 
          autoConnect={true}
          preferredWallets={[
            "Bitget Wallet",
            "Sui Wallet",
            "Surf Wallet",
            "Martian Wallet",
            "Ethos Wallet",
            "Suiet",
            "Trust Wallet",
            "Slush Wallet",
            "Bitkeep Wallet",
            "Bitpie Wallet",
            "Bitpie Wallet",
          ]}
        >
          {children}
        </DynamicWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

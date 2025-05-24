"use client";

import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

const queryClient = new QueryClient();
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider client={suiClient}>
        <WalletProvider autoConnect={true} preferredWallets={["Sui Wallet", "Surf Wallet", "Martian"]}>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

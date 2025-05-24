"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WalletProvider,
  SuiClientProvider,
  createNetworkConfig,

} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
});

export default function WalletProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

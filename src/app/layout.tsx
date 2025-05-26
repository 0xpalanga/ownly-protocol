// app/layout.tsx
"use client";

import "./globals.css";
import '@mysten/dapp-kit/dist/index.css';
import "@mysten/dapp-kit";
import { Inter } from "next/font/google";
import dynamic from 'next/dynamic';
import {
  SuiClientProvider,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui.js/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";

// Dynamically import WalletProvider with no SSR
const WalletProvider = dynamic(
  () => import('@mysten/dapp-kit').then((mod) => mod.WalletProvider),
  { ssr: false }
);

const inter = Inter({ subsets: ["latin"] });

// Create a query client instance
const queryClient = new QueryClient();

// Set up network configuration
const networks = {
  testnet: { url: getFullnodeUrl("testnet") },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-900 text-white min-h-screen`}>
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networks} defaultNetwork="testnet">
            <WalletProvider autoConnect>
              <Navbar />
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}

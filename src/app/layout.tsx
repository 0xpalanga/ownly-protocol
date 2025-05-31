// app/layout.tsx
"use client";

import "./globals.css";
import "./fonts.css";
import '@mysten/dapp-kit/dist/index.css';
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 text-white min-h-screen font-[var(--font-inter)]">
        <Providers>
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

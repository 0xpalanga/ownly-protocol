// app/layout.tsx
"use client";

import "./globals.css";
import "./fonts.css";
import '@mysten/dapp-kit/dist/index.css';
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { ThemeProvider } from '@/lib/theme';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors font-sans">
        <ThemeProvider>
          <Providers>
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

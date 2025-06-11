// app/layout.tsx
"use client";

import "./globals.css";
import "./fonts.css";
import '@mysten/dapp-kit/dist/index.css';
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.className} min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors`}>
      <body className={`${inter.className} min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors`}>
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

import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';

export function Navbar() {
  const account = useCurrentAccount();

  return (
    <nav className="border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
            Ownly Protocol
          </Link>
          
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {account && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 
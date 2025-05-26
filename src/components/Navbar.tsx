import Link from 'next/link';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';

export function Navbar() {
  const account = useCurrentAccount();

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold">
              Ownly Protocol
            </Link>
          </div>
          
          {/* Navigation Links - Centered */}
          <div className="flex items-center justify-center space-x-8 flex-grow">
            <Link href="/dashboard" className="hover:text-gray-300 font-medium">
              Dashboard
            </Link>
            <Link href="/dashboard/send" className="hover:text-gray-300 font-medium">
              Send
            </Link>
            <Link href="/dashboard/receive" className="hover:text-gray-300 font-medium">
              Receive
            </Link>
            <Link href="/dashboard/history" className="hover:text-gray-300 font-medium">
              History
            </Link>
          </div>
          
          {/* Wallet Connection - Right Side */}
          <div className="flex-shrink-0">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
} 
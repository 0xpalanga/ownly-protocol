import Link from 'next/link';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';

export function Navbar() {
  const account = useCurrentAccount();

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Testnet Indicator */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Ownly Protocol
            </Link>
            <span className="text-sm text-red-500 animate-pulse"><b>TESNET</b></span>
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
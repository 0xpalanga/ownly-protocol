import { useCurrentAccount, ConnectButton } from '@mysten/dapp-kit';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export function Navbar() {
  const account = useCurrentAccount();
  const router = useRouter();

  const handleDisconnect = () => {
    try {
      // Remove wallet connection cookies
      Cookies.remove('internal_wallet_connected', { path: '/' });
      Cookies.remove('internal_wallet_address', { path: '/' });
      Cookies.remove('sui_wallet_connected', { path: '/' });

      // Clear local storage if needed
      localStorage.removeItem('ownly_internal_wallet');
      localStorage.removeItem('ownly_wallet_exists');

      // Redirect to home page
      router.push('/');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      router.push('/');
    }
  };

  return (
    <nav className="border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
            Ownly Protocol
          </Link>
          
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
} 
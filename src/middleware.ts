import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/dashboard/send',
  '/dashboard/decrypt',
];

export function middleware(request: NextRequest) {
  // Check both internal wallet and Sui wallet connection states
  const isInternalWalletConnected = request.cookies.get('internal_wallet_connected')?.value === 'true';
  const isSuiWalletConnected = request.cookies.get('sui_wallet_connected')?.value === 'true';
  const internalWalletAddress = request.cookies.get('internal_wallet_address')?.value;
  const path = request.nextUrl.pathname;

  // Check if the path requires authentication
  const isProtectedPath = PROTECTED_PATHS.some(protectedPath => 
    path === protectedPath || path.startsWith(`${protectedPath}/`)
  );

  // Allow access if either wallet is properly connected
  const isAuthenticated = (isInternalWalletConnected && internalWalletAddress) || isSuiWalletConnected;

  // If it's a protected path and no wallet is properly connected, redirect to home
  if (isProtectedPath && !isAuthenticated) {
    // Clear any invalid wallet cookies
    const response = NextResponse.redirect(new URL('/', request.url));
    if (isInternalWalletConnected && !internalWalletAddress) {
      response.cookies.delete('internal_wallet_connected');
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
}; 
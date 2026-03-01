'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAccount, useConnect, useSignMessage } from 'wagmi';
import Button from '@/components/ui/Button';

export default function Home() {
  const router = useRouter();
  const { user, isLoading, error, login, loginWithWallet } = useAuth();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const [walletLoading, setWalletLoading] = useState(false);

  // Detect if inside Farcaster Mini App
  const isInMiniApp =
    typeof window !== 'undefined' &&
    !!(window as { ReactNativeWebView?: unknown }).ReactNativeWebView;

  // If already authenticated, redirect to lobby
  useEffect(() => {
    if (user && !isLoading) {
      router.replace('/lobby');
    }
  }, [user, isLoading, router]);

  // Auto-trigger wallet auth once MetaMask connects (browser only)
  useEffect(() => {
    if (isConnected && address && !user && !isLoading && !isInMiniApp && !walletLoading) {
      setWalletLoading(true);
      loginWithWallet(address, signMessageAsync).finally(() => {
        setWalletLoading(false);
      });
    }
  }, [isConnected, address, user, isLoading, isInMiniApp, walletLoading, loginWithWallet, signMessageAsync]);

  // Loading state
  if (isLoading || walletLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl animate-pulse">{'\u265A'}</div>
        <p className="text-sm text-[var(--muted)]">
          {walletLoading ? 'Signing in...' : 'Loading...'}
        </p>
      </div>
    );
  }

  // Already logged in — show nothing while redirecting
  if (user) return null;

  function handleConnectWallet() {
    // Find injected connector (MetaMask, Rabby, etc.)
    const injectedConnector = connectors.find((c) => c.id === 'injected');
    if (injectedConnector) {
      connect({ connector: injectedConnector });
      return;
    }
    // Fallback
    const first = connectors[0];
    if (first) connect({ connector: first });
  }

  // Splash / Login screen
  return (
    <div className="flex flex-col items-center justify-center h-screen px-6 gap-8">
      {/* Logo */}
      <div className="text-center">
        <div className="text-6xl mb-3">{'\u265A'}</div>
        <h1 className="text-2xl font-bold">Royal Bullet Chess</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          1+0 Bullet &middot; USDC on Base
        </p>
      </div>

      {/* Login */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {isInMiniApp ? (
          /* Farcaster Mini App → Farcaster auth */
          <Button onClick={login} className="w-full">
            Sign in with Farcaster
          </Button>
        ) : (
          /* Regular browser → Wallet auth */
          <Button onClick={handleConnectWallet} className="w-full">
            Connect Wallet
          </Button>
        )}

        {error && (
          <p className="text-xs text-[var(--danger)] text-center">{error}</p>
        )}

        <p className="text-xs text-[var(--muted)] text-center">
          Play bullet chess with real stakes on Base
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import Button from '@/components/ui/Button';

export default function Home() {
  const router = useRouter();
  const { user, isLoading, error, login } = useAuth();

  // If already authenticated, redirect to lobby
  useEffect(() => {
    if (user && !isLoading) {
      router.replace('/lobby');
    }
  }, [user, isLoading, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl animate-pulse">{'\u265A'}</div>
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  // Already logged in — show nothing while redirecting
  if (user) return null;

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
        <Button onClick={login} className="w-full">
          Sign in with Farcaster
        </Button>

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

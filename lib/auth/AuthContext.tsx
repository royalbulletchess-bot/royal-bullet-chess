'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  loginWithWallet: (address: string, signMessageAsync: (args: { message: string }) => Promise<string>) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const SESSION_KEY = 'rbc_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    sessionToken: null,
    isLoading: true,
    error: null,
  });

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const { sessionToken, user } = JSON.parse(stored);
        setState({ user, sessionToken, isLoading: false, error: null });
        return;
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  const login = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      let farcasterToken: string | null = null;
      let username = 'Player';
      let displayName: string | undefined;
      let pfpUrl: string | undefined;
      let fid: number | undefined;

      // Check if we're inside a Farcaster Mini App
      const isInMiniApp = typeof window !== 'undefined' && !!window.ReactNativeWebView;

      if (isInMiniApp) {
        // Production: use Farcaster SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');
        await sdk.actions.ready();

        const context = await sdk.context;
        fid = context.user.fid;
        username = context.user.username || `fid:${fid}`;
        displayName = context.user.displayName;
        pfpUrl = context.user.pfpUrl;

        const { token } = await sdk.quickAuth.getToken();
        farcasterToken = token;
      }

      // Send to our API
      const res = await fetch('/api/auth/farcaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farcasterToken,
          fid,
          username,
          displayName,
          avatar: pfpUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Auth failed' }));
        throw new Error(data.error || 'Authentication failed');
      }

      const { user, sessionToken } = await res.json();

      // Persist session
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user, sessionToken }));

      setState({ user, sessionToken, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  const loginWithWallet = useCallback(
    async (
      address: string,
      signMessageAsync: (args: { message: string }) => Promise<string>
    ) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        // Build SIWE-style message
        const message = [
          'Sign in to Royal Bullet Chess',
          `Wallet: ${address.toLowerCase()}`,
          `Timestamp: ${new Date().toISOString()}`,
        ].join('\n');

        // Ask user to sign the message via their wallet
        const signature = await signMessageAsync({ message });

        // Send to wallet auth endpoint
        const res = await fetch('/api/auth/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, message, signature }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Wallet auth failed' }));
          throw new Error(data.error || 'Wallet authentication failed');
        }

        const { user, sessionToken } = await res.json();

        // Persist session
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user, sessionToken }));

        setState({ user, sessionToken, isLoading: false, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Wallet login failed';
        // Don't show error if user rejected the signature
        if (message.includes('User rejected') || message.includes('user rejected')) {
          setState((s) => ({ ...s, isLoading: false, error: null }));
        } else {
          setState((s) => ({ ...s, isLoading: false, error: message }));
        }
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setState({ user: null, sessionToken: null, isLoading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithWallet, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

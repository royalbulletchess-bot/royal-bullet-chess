'use client';

import { useAccount, useReadContract, useConnect, useDisconnect } from 'wagmi';
import { ERC20_ABI, USDC_TOKEN_ADDRESS } from '@/lib/web3/contracts';
import { USDC_DECIMALS } from '@/lib/constants';
import { useState } from 'react';

/**
 * Displays on-chain USDC balance and wallet connection status.
 *
 * Environment-aware connect logic:
 * - Inside Farcaster Mini App (window.ReactNativeWebView exists) → uses farcasterFrame connector
 * - In regular browser → uses injected connector (MetaMask, etc.)
 */
export default function WalletInfo() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [connectError, setConnectError] = useState<string | null>(null);

  // Read on-chain USDC balance
  const { data: rawBalance, isLoading: balanceLoading } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15_000, // Refresh every 15s
    },
  });

  const balance = rawBalance
    ? Number(rawBalance) / 10 ** USDC_DECIMALS
    : 0;

  function handleConnect() {
    setConnectError(null);

    // Detect if we're inside a Farcaster Mini App (Warpcast WebView)
    const isInMiniApp = typeof window !== 'undefined' && !!(window as { ReactNativeWebView?: unknown }).ReactNativeWebView;

    if (isInMiniApp) {
      // Inside Farcaster Mini App → use farcasterFrame connector
      const farcasterConnector = connectors.find((c) => c.id === 'farcasterFrame');
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
        return;
      }
    }

    // Regular browser → use injected connector (MetaMask, Rabby, etc.)
    const injectedConnector = connectors.find((c) => c.id === 'injected');
    if (injectedConnector) {
      connect({ connector: injectedConnector });
      return;
    }

    // Fallback: try the first available connector
    const firstConnector = connectors[0];
    if (firstConnector) {
      connect({ connector: firstConnector });
      return;
    }

    // No connector available
    setConnectError('No wallet found. Please install MetaMask or open this app in Warpcast.');
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--muted)]">Wallet</p>
            <p className="text-sm font-medium mt-1">Not connected</p>
            {connectError && (
              <p className="text-xs text-red-400 mt-1">{connectError}</p>
            )}
          </div>
          <button
            onClick={handleConnect}
            className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-4 py-2 text-sm transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--muted)]">On-chain Balance</p>
          <p className="text-2xl font-bold">
            {balanceLoading ? (
              <span className="inline-block h-6 w-20 animate-pulse rounded bg-[var(--border)]" />
            ) : (
              `$${balance.toFixed(2)}`
            )}
          </p>
          <p className="text-xs text-[var(--muted)]">USDC &middot; {shortAddress}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-[var(--muted)]">Connected</span>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-[var(--muted)] hover:text-white transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

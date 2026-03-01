'use client';

import { useAccount, useReadContract, useConnect } from 'wagmi';
import { ERC20_ABI, USDC_TOKEN_ADDRESS } from '@/lib/web3/contracts';
import { USDC_DECIMALS } from '@/lib/constants';

/**
 * Displays on-chain USDC balance and wallet connection status.
 * Replaces the old BalanceDisplay component (which used off-chain balance).
 */
export default function WalletInfo() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();

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

  if (!isConnected) {
    return (
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--muted)]">Wallet</p>
            <p className="text-sm font-medium mt-1">Not connected</p>
          </div>
          <button
            onClick={() => {
              const connector = connectors[0];
              if (connector) connect({ connector });
            }}
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
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-[var(--muted)]">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

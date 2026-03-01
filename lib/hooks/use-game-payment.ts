'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import {
  ERC20_ABI,
  GAME_ESCROW_ABI,
  GAME_ESCROW_ADDRESS,
  USDC_TOKEN_ADDRESS,
  uuidToBytes32,
} from '@/lib/web3/contracts';
import { USDC_DECIMALS } from '@/lib/constants';

// ── Types ──

export type PaymentStatus =
  | 'idle'
  | 'approving'
  | 'approved'
  | 'sending'
  | 'pending'
  | 'confirmed'
  | 'error';

interface PaymentResult {
  txHash: string;
  status: 'confirmed';
}

interface UseGamePaymentReturn {
  /** Pay to create a new game (approve USDC + createGame) */
  createAndPay: (betAmount: number, gameId: string) => Promise<PaymentResult>;
  /** Pay to join an existing game (approve USDC + joinGame) */
  joinAndPay: (gameId: string, betAmount: number) => Promise<PaymentResult>;
  /** Current payment status */
  status: PaymentStatus;
  /** Transaction hash (available after sending) */
  txHash: string | null;
  /** Error message if payment failed */
  error: string | null;
  /** Reset state back to idle */
  reset: () => void;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Connected wallet address */
  address: `0x${string}` | undefined;
}

// ── Mock mode check ──
const isMockMode = process.env.NEXT_PUBLIC_MOCK_PAYMENTS === 'true';

/**
 * Hook for handling per-game USDC payments via the GameEscrow smart contract.
 *
 * Flow:
 * 1. Approve USDC spending to escrow contract
 * 2. Wait for approval tx confirmation
 * 3. Call createGame/joinGame on escrow contract
 * 4. Wait for game tx confirmation
 * 5. Return txHash for server-side verification
 *
 * In dev mode (NEXT_PUBLIC_MOCK_PAYMENTS=true), skips real transactions
 * and returns a mock txHash.
 */
export function useGamePayment(): UseGamePaymentReturn {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  /**
   * Wait for a transaction to be confirmed on-chain.
   * Uses polling with exponential backoff.
   */
  const waitForReceipt = useCallback(async (hash: `0x${string}`): Promise<void> => {
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org';
    const maxAttempts = 30;
    let delay = 2000; // Start with 2s

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionReceipt',
            params: [hash],
          }),
        });

        const data = await res.json();
        if (data.result) {
          if (data.result.status === '0x1') {
            return; // Success
          } else {
            throw new Error('Transaction reverted on-chain');
          }
        }
      } catch (err) {
        if (i === maxAttempts - 1) throw err;
      }

      // Cap delay at 5s
      delay = Math.min(delay * 1.3, 5000);
    }

    throw new Error('Transaction confirmation timeout');
  }, []);

  /**
   * Step 1: Approve USDC spending for the escrow contract
   */
  const approveUsdc = useCallback(async (amount: number): Promise<`0x${string}`> => {
    if (!address) throw new Error('Wallet not connected');

    const amountInUnits = parseUnits(amount.toString(), USDC_DECIMALS);

    setStatus('approving');

    const hash = await writeContractAsync({
      address: USDC_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [GAME_ESCROW_ADDRESS, amountInUnits],
    });

    // Wait for approval to be confirmed
    await waitForReceipt(hash);
    setStatus('approved');

    return hash;
  }, [address, writeContractAsync, waitForReceipt]);

  /**
   * Approve USDC + call createGame on escrow contract.
   * Returns the createGame txHash for server verification.
   */
  const createAndPay = useCallback(async (
    betAmount: number,
    gameId: string
  ): Promise<PaymentResult> => {
    // Mock mode — skip real tx
    if (isMockMode) {
      const mockHash = `0xdev_mock_create_${gameId}_${Date.now()}`;
      setTxHash(mockHash);
      setStatus('confirmed');
      return { txHash: mockHash, status: 'confirmed' };
    }

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      setStatus('error');
      throw new Error('Wallet not connected');
    }

    if (!GAME_ESCROW_ADDRESS) {
      setError('Escrow contract address not configured');
      setStatus('error');
      throw new Error('GAME_ESCROW_ADDRESS not set');
    }

    try {
      setError(null);

      // Step 1: Approve USDC
      await approveUsdc(betAmount);

      // Step 2: Call createGame on escrow
      setStatus('sending');
      const amountInUnits = parseUnits(betAmount.toString(), USDC_DECIMALS);
      const gameIdBytes32 = uuidToBytes32(gameId);

      const gameTxHash = await writeContractAsync({
        address: GAME_ESCROW_ADDRESS,
        abi: GAME_ESCROW_ABI,
        functionName: 'createGame',
        args: [gameIdBytes32, amountInUnits],
      });

      setTxHash(gameTxHash);
      setStatus('pending');

      // Step 3: Wait for confirmation
      await waitForReceipt(gameTxHash);
      setStatus('confirmed');

      return { txHash: gameTxHash, status: 'confirmed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      // User rejection
      if (message.includes('User rejected') || message.includes('user rejected')) {
        setError('Transaction cancelled by user');
      } else {
        setError(message);
      }
      setStatus('error');
      throw err;
    }
  }, [isConnected, address, approveUsdc, writeContractAsync, waitForReceipt]);

  /**
   * Approve USDC + call joinGame on escrow contract.
   * Returns the joinGame txHash for server verification.
   */
  const joinAndPay = useCallback(async (
    gameId: string,
    betAmount: number
  ): Promise<PaymentResult> => {
    // Mock mode
    if (isMockMode) {
      const mockHash = `0xdev_mock_join_${gameId}_${Date.now()}`;
      setTxHash(mockHash);
      setStatus('confirmed');
      return { txHash: mockHash, status: 'confirmed' };
    }

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      setStatus('error');
      throw new Error('Wallet not connected');
    }

    if (!GAME_ESCROW_ADDRESS) {
      setError('Escrow contract address not configured');
      setStatus('error');
      throw new Error('GAME_ESCROW_ADDRESS not set');
    }

    try {
      setError(null);

      // Step 1: Approve USDC
      await approveUsdc(betAmount);

      // Step 2: Call joinGame on escrow
      setStatus('sending');
      const gameIdBytes32 = uuidToBytes32(gameId);

      const gameTxHash = await writeContractAsync({
        address: GAME_ESCROW_ADDRESS,
        abi: GAME_ESCROW_ABI,
        functionName: 'joinGame',
        args: [gameIdBytes32],
      });

      setTxHash(gameTxHash);
      setStatus('pending');

      // Step 3: Wait for confirmation
      await waitForReceipt(gameTxHash);
      setStatus('confirmed');

      return { txHash: gameTxHash, status: 'confirmed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (message.includes('User rejected') || message.includes('user rejected')) {
        setError('Transaction cancelled by user');
      } else {
        setError(message);
      }
      setStatus('error');
      throw err;
    }
  }, [isConnected, address, approveUsdc, writeContractAsync, waitForReceipt]);

  return {
    createAndPay,
    joinAndPay,
    status,
    txHash,
    error,
    reset,
    isConnected,
    address,
  };
}

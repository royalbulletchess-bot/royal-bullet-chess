/**
 * Server-side utility to call GameEscrow contract functions.
 * Uses viem WalletClient with the backend private key.
 */
import { createWalletClient, createPublicClient, http, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { GAME_ESCROW_ABI, GAME_ESCROW_ADDRESS, uuidToBytes32 } from './contracts';

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532');
const isTestnet = chainId === 84532;
const chain = isTestnet ? baseSepolia : base;
const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || (
  isTestnet ? 'https://sepolia.base.org' : 'https://mainnet.base.org'
);

function getWalletClient() {
  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BACKEND_WALLET_PRIVATE_KEY not configured');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}

function getPublicClient() {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Call finishGame on the escrow contract — pays out the winner.
 */
export async function finishGameOnChain(
  gameId: string,
  winnerAddress: string
): Promise<{ txHash: Hash } | { error: string }> {
  try {
    const client = getWalletClient();
    const gameIdBytes = uuidToBytes32(gameId);

    const hash = await client.writeContract({
      address: GAME_ESCROW_ADDRESS,
      abi: GAME_ESCROW_ABI,
      functionName: 'finishGame',
      args: [gameIdBytes, winnerAddress as `0x${string}`],
    });

    // Wait for confirmation
    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });

    console.log(`[finishGameOnChain] Game ${gameId} finished. Winner: ${winnerAddress}. Tx: ${hash}`);
    return { txHash: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[finishGameOnChain] Error:`, message);
    return { error: message };
  }
}

/**
 * Call finishDraw on the escrow contract — refunds both players.
 */
export async function finishDrawOnChain(
  gameId: string
): Promise<{ txHash: Hash } | { error: string }> {
  try {
    const client = getWalletClient();
    const gameIdBytes = uuidToBytes32(gameId);

    const hash = await client.writeContract({
      address: GAME_ESCROW_ADDRESS,
      abi: GAME_ESCROW_ABI,
      functionName: 'finishDraw',
      args: [gameIdBytes],
    });

    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });

    console.log(`[finishDrawOnChain] Game ${gameId} drawn. Tx: ${hash}`);
    return { txHash: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[finishDrawOnChain] Error:`, message);
    return { error: message };
  }
}

/**
 * Call cancelGame on the escrow contract — refunds creator (and opponent if joined).
 */
export async function cancelGameOnChain(
  gameId: string
): Promise<{ txHash: Hash } | { error: string }> {
  try {
    const client = getWalletClient();
    const gameIdBytes = uuidToBytes32(gameId);

    const hash = await client.writeContract({
      address: GAME_ESCROW_ADDRESS,
      abi: GAME_ESCROW_ABI,
      functionName: 'cancelGame',
      args: [gameIdBytes],
    });

    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });

    console.log(`[cancelGameOnChain] Game ${gameId} cancelled. Tx: ${hash}`);
    return { txHash: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[cancelGameOnChain] Error:`, message);
    return { error: message };
  }
}

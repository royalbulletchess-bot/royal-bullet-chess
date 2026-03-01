/**
 * Server-side utility to verify on-chain transactions.
 * Uses raw RPC calls (no wagmi — this runs in API routes).
 */

interface VerifyPaymentResult {
  valid: boolean;
  amount: number; // in USDC (human readable, e.g. 5.00)
  from: string;
  error?: string;
}

const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org';

/**
 * Verify that a transaction contains a GameEscrow event (GameCreated or GameJoined).
 * For mock payments in dev mode, accepts 0xdev_mock_ prefix.
 */
export async function verifyGamePayment(
  txHash: string
): Promise<VerifyPaymentResult> {
  // Dev mock mode
  if (
    process.env.NEXT_PUBLIC_MOCK_PAYMENTS === 'true' &&
    txHash.startsWith('0xdev_mock_')
  ) {
    return {
      valid: true,
      amount: 0,
      from: '0x0000000000000000000000000000000000000000',
    };
  }

  try {
    // Fetch transaction receipt
    const receiptRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    const receiptData = await receiptRes.json();
    const receipt = receiptData.result;

    if (!receipt) {
      return { valid: false, amount: 0, from: '', error: 'Transaction not found or not confirmed' };
    }

    if (receipt.status !== '0x1') {
      return { valid: false, amount: 0, from: '', error: 'Transaction failed on-chain' };
    }

    // Verify the transaction was sent to the escrow contract
    const escrowAddress = process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS?.toLowerCase();
    if (escrowAddress && receipt.to?.toLowerCase() !== escrowAddress) {
      return { valid: false, amount: 0, from: '', error: 'Transaction not to escrow contract' };
    }

    // Parse GameCreated or GameJoined event
    // GameCreated topic: keccak256("GameCreated(bytes32,address,uint256)")
    // TODO: Add actual event topic verification after contract deployment
    // For now, we trust the tx was to the contract and succeeded

    const from = receipt.from;

    // Parse USDC Transfer logs to get the amount
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '').toLowerCase();

    let amount = 0;
    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === usdcAddress &&
        log.topics[0] === TRANSFER_TOPIC
      ) {
        const rawAmount = BigInt(log.data);
        amount = Number(rawAmount) / 1e6; // USDC has 6 decimals
        break;
      }
    }

    return { valid: true, amount, from };
  } catch (err) {
    console.error('[verifyGamePayment] Error:', err);
    return { valid: false, amount: 0, from: '', error: 'Verification failed' };
  }
}

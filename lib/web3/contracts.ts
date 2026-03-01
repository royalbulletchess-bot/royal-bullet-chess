/**
 * Smart contract ABIs and addresses for GameEscrow + USDC
 */

// ── Contract Addresses ──
export const GAME_ESCROW_ADDRESS = (
  process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || ''
) as `0x${string}`;

export const USDC_TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
) as `0x${string}`;

// Base Sepolia test USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
// Base Mainnet USDC:      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

// ── ERC-20 ABI (minimal) ──
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

// ── GameEscrow ABI ──
export const GAME_ESCROW_ABI = [
  // ── Player Functions ──
  {
    name: 'createGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'betAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'joinGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
  },
  // ── Owner Functions ──
  {
    name: 'finishGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'winner', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'finishDraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'cancelGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
  },
  // ── View Functions ──
  {
    name: 'getGame',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'opponent', type: 'address' },
      { name: 'betAmount', type: 'uint256' },
      { name: 'potAmount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  },
  {
    name: 'usdc',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'treasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'commissionBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // ── Events ──
  {
    name: 'GameCreated',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'betAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'GameJoined',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'opponent', type: 'address', indexed: true },
    ],
  },
  {
    name: 'GameFinished',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'payout', type: 'uint256', indexed: false },
      { name: 'commission', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'GameDrawn',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'refundEach', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'GameCancelled',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ── Helpers ──

/**
 * Convert a UUID string to bytes32 for the smart contract.
 * Removes dashes and pads to 32 bytes.
 */
export function uuidToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.replace(/-/g, '');
  // UUID is 16 bytes (32 hex chars), pad to 32 bytes (64 hex chars)
  return `0x${hex.padEnd(64, '0')}` as `0x${string}`;
}

/**
 * Convert bytes32 back to UUID string.
 */
export function bytes32ToUuid(bytes32: string): string {
  const hex = bytes32.replace('0x', '').slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

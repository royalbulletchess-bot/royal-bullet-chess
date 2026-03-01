// ============================================================
// Royal Bullet Chess — Constants & Configuration
// ============================================================

// Bet amounts
export const BET_AMOUNTS = [1, 2, 5, 10] as const;
export const MAX_CUSTOM_BET = 500;
export const MIN_CUSTOM_BET_STEP = 10;

// Commission
export const COMMISSION_RATE = 0.10; // 10%
export const DRAW_FEE_CENTS = 0.01; // $0.01 per player on draw

// Timeouts
export const LOBBY_EXPIRY_SECONDS = 300;     // 5 minutes
export const APPROVAL_TIMEOUT_SECONDS = 60;  // 60 seconds
export const EMERGENCY_REFUND_DELAY = 86400; // 24 hours in seconds

// Game
export const GAME_TIME_MS = 60_000;    // 1+0 bullet = 60 seconds
export const GAME_TIME_SECONDS = 60;
export const LOW_TIME_WARNING_MS = 10_000; // warning at 10 seconds

// Withdrawals
export const MIN_WITHDRAW_AMOUNT = 1.00; // $1 minimum

// ELO
export const DEFAULT_ELO = 1200;
export const ELO_K_FACTOR = 32;

// Blockchain
// Chain config is driven by NEXT_PUBLIC_CHAIN_ID env var (84532 = Base Sepolia, 8453 = Base Mainnet)
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532');

// USDC addresses per chain
export const USDC_ADDRESS_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || USDC_ADDRESS_SEPOLIA;

// USDC decimals
export const USDC_DECIMALS = 6;

// Commission in basis points (1000 = 10%)
export const COMMISSION_BPS = 1000;

// Chess
export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Quick Play
export const QUICK_PLAY_AMOUNTS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100, 500] as const;
export const QUICK_PLAY_SEARCH_TIMEOUT_MS = 3000; // Phase 1 mock matchmaking

// Lobby
export const MAX_LOBBIES_PER_USER = 1;

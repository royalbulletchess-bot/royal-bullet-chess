import { Chess } from 'chess.js';
import type { PlayerColor } from '@/types';

/**
 * Create a new Chess instance from a FEN string.
 * Falls back to the starting position if no FEN is provided.
 */
export function createGame(fen?: string): Chess {
  return new Chess(fen);
}

/**
 * Validate and make a move. Returns the new FEN if legal, null otherwise.
 */
export function tryMove(
  fen: string,
  move: string | { from: string; to: string; promotion?: string }
): { newFen: string; san: string } | null {
  const game = new Chess(fen);
  try {
    const result = game.move(move);
    if (!result) return null;
    return { newFen: game.fen(), san: result.san };
  } catch {
    return null;
  }
}

/**
 * Determine whose turn it is from a FEN string.
 */
export function getTurn(fen: string): PlayerColor {
  const game = new Chess(fen);
  return game.turn() === 'w' ? 'WHITE' : 'BLACK';
}

/**
 * Check if the game is over (checkmate, stalemate, draw).
 */
export function getGameOverReason(fen: string): string | null {
  const game = new Chess(fen);
  if (game.isCheckmate()) return 'checkmate';
  if (game.isStalemate()) return 'stalemate';
  if (game.isThreefoldRepetition()) return 'threefold_repetition';
  if (game.isInsufficientMaterial()) return 'insufficient_material';
  if (game.isDraw()) return 'fifty_move_rule';
  return null;
}

/**
 * Check if a specific side is in check.
 */
export function isInCheck(fen: string): boolean {
  const game = new Chess(fen);
  return game.inCheck();
}

/**
 * Get all legal moves from a FEN position.
 */
export function getLegalMoves(fen: string): string[] {
  const game = new Chess(fen);
  return game.moves();
}

/**
 * Format milliseconds as "M:SS" for timer display.
 */
export function formatTime(ms: number): string {
  if (ms <= 0) return '0.0';
  if (ms < 10_000) {
    return (Math.ceil(ms / 100) / 10).toFixed(1);
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate new time remaining after a move.
 * Uses timestamp-based calculation for server authority.
 */
/**
 * Calculate captured pieces and material advantage from FEN.
 */
export function getCapturedPieces(fen: string): {
  white: string[];
  black: string[];
  advantage: number;
} {
  const STARTING_PIECES: Record<string, number> = {
    p: 8, r: 2, n: 2, b: 2, q: 1, k: 1,
    P: 8, R: 2, N: 2, B: 2, Q: 1, K: 1,
  };
  const PIECE_VALUES: Record<string, number> = {
    p: 1, n: 3, b: 3, r: 5, q: 9,
  };
  const ORDER = ['q', 'r', 'b', 'n', 'p'];

  const boardPart = fen.split(' ')[0];
  const counts: Record<string, number> = {};
  for (const ch of boardPart) {
    if (/[a-zA-Z]/.test(ch) && ch !== '/') {
      counts[ch] = (counts[ch] || 0) + 1;
    }
  }

  // White captured = black pieces missing from board
  const whiteCaptured: string[] = [];
  // Black captured = white pieces missing from board
  const blackCaptured: string[] = [];
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (const piece of ORDER) {
    const blackPiece = piece; // lowercase = black
    const whitePiece = piece.toUpperCase(); // uppercase = white

    const missingBlack = (STARTING_PIECES[blackPiece] || 0) - (counts[blackPiece] || 0);
    for (let i = 0; i < missingBlack; i++) {
      whiteCaptured.push(piece);
      whiteMaterial += PIECE_VALUES[piece] || 0;
    }

    const missingWhite = (STARTING_PIECES[whitePiece] || 0) - (counts[whitePiece] || 0);
    for (let i = 0; i < missingWhite; i++) {
      blackCaptured.push(piece);
      blackMaterial += PIECE_VALUES[piece] || 0;
    }
  }

  return {
    white: whiteCaptured,
    black: blackCaptured,
    advantage: whiteMaterial - blackMaterial,
  };
}

export function calculateTimeAfterMove(
  previousRemainingMs: number,
  moveStartedAt: string,
  moveEndedAt: string
): number {
  const elapsed = new Date(moveEndedAt).getTime() - new Date(moveStartedAt).getTime();
  return Math.max(0, previousRemainingMs - elapsed);
}

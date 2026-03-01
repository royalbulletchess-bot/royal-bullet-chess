import { ELO_K_FACTOR } from '@/lib/constants';

/**
 * Standard ELO rating calculation.
 * K-factor = 32 (good for rapid/bullet games).
 *
 * @param playerRating  The current ELO of the player
 * @param opponentRating The current ELO of the opponent
 * @param result  1 = win, 0.5 = draw, 0 = loss
 * @returns The new ELO rating (rounded to nearest integer)
 */
export function calculateNewElo(
  playerRating: number,
  opponentRating: number,
  result: 0 | 0.5 | 1
): number {
  const expectedScore =
    1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const newRating = playerRating + ELO_K_FACTOR * (result - expectedScore);
  return Math.round(newRating);
}

/**
 * Calculate ELO changes for both players in a game.
 *
 * @param whiteElo  White's current ELO
 * @param blackElo  Black's current ELO
 * @param result    'WHITE_WIN' | 'BLACK_WIN' | 'DRAW'
 * @returns { whiteNew, blackNew, whiteDelta, blackDelta }
 */
export function calculateGameElo(
  whiteElo: number,
  blackElo: number,
  result: 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW'
): {
  whiteNew: number;
  blackNew: number;
  whiteDelta: number;
  blackDelta: number;
} {
  let whiteResult: 0 | 0.5 | 1;
  let blackResult: 0 | 0.5 | 1;

  switch (result) {
    case 'WHITE_WIN':
      whiteResult = 1;
      blackResult = 0;
      break;
    case 'BLACK_WIN':
      whiteResult = 0;
      blackResult = 1;
      break;
    case 'DRAW':
      whiteResult = 0.5;
      blackResult = 0.5;
      break;
  }

  const whiteNew = calculateNewElo(whiteElo, blackElo, whiteResult);
  const blackNew = calculateNewElo(blackElo, whiteElo, blackResult);

  return {
    whiteNew,
    blackNew,
    whiteDelta: whiteNew - whiteElo,
    blackDelta: blackNew - blackElo,
  };
}

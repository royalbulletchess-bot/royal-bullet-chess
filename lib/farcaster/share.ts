/**
 * Farcaster sharing utilities
 * Uses the Farcaster Mini App SDK composeCast to share game results
 */

interface ShareGameResultParams {
  result: 'win' | 'loss' | 'draw';
  opponent: string;
  betAmount: number;
  payout: number;
  moves: number;
  gameId: string;
}

/**
 * Compose a Farcaster cast to share a game result.
 * Works inside the Farcaster Mini App environment.
 */
export async function shareGameResult({
  result,
  opponent,
  betAmount,
  payout,
  moves,
  gameId,
}: ShareGameResultParams): Promise<boolean> {
  const emoji = result === 'win' ? '♛' : result === 'draw' ? '♞' : '♚';
  const resultText =
    result === 'win'
      ? `Won $${payout.toFixed(2)} USDC`
      : result === 'draw'
        ? 'Draw!'
        : `Lost $${betAmount.toFixed(2)} USDC`;

  const text = [
    `${emoji} Royal Bullet Chess`,
    '',
    `${resultText} vs @${opponent}`,
    `${moves} moves · 1+0 Bullet · $${betAmount} bet`,
    '',
    `Play me on Royal Bullet Chess!`,
  ].join('\n');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://royal-bullet-chess.vercel.app';
  const embedUrl = `${appUrl}/game-over/${gameId}`;

  try {
    // Check if we're inside a Farcaster Mini App
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      await sdk.actions.composeCast({
        text,
        embeds: [embedUrl],
      });
      return true;
    }

    // Fallback: open Warpcast compose URL
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`;
    window.open(warpcastUrl, '_blank');
    return true;
  } catch (err) {
    console.error('[share] Failed to compose cast:', err);
    return false;
  }
}

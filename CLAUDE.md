# Royal Bullet Chess — Project Guide

## Project Overview
1+0 Bullet chess Farcaster Mini App with USDC bets on Base. Built with Next.js 14 App Router, Supabase (Postgres + Realtime), Wagmi v2, Viem v2.

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Database:** Supabase (PostgreSQL + Realtime broadcast channels)
- **Auth:** Custom JWT sessions (jose, HS256) — NOT Supabase Auth. `auth.uid()` is NULL for all users.
- **Web3:** Wagmi v2 + Viem v2, GameEscrow Solidity contract on Base Sepolia
- **Wallet Auth:** SIWE-style (Sign-In With Ethereum) via `/api/auth/wallet`

## Critical Architecture Notes
- **RLS + Custom JWT:** Since we use custom JWT (not Supabase Auth), `auth.uid()` is always NULL. This means `postgres_changes` subscriptions often fail because RLS blocks events. Use **Supabase broadcast channels** instead (they bypass RLS).
- **Broadcast channels** are used for real-time game updates (`game-broadcast-{gameId}`).
- **Optimistic moves:** Client applies moves locally, then sends to server. If server rejects, client should rollback (currently broken — see bugs).
- **Mock payments:** `NEXT_PUBLIC_MOCK_PAYMENTS=true` — no real blockchain tx, fake txHash.

## Key File Structure
```
app/
  page.tsx                          # Login (Farcaster or Wallet)
  lobby/page.tsx                    # Main lobby with tabs
  create/page.tsx                   # Create lobby game
  play-ai/page.tsx                  # AI difficulty selection
  game/[id]/page.tsx                # Multiplayer game (state machine)
  game-over/[id]/page.tsx           # Game results page
  game-ai/[difficulty]/page.tsx     # AI game
  api/
    auth/wallet/route.ts            # Wallet SIWE auth
    auth/farcaster/route.ts         # Farcaster auth
    games/route.ts                  # Create game
    games/[id]/route.ts             # Get game data
    games/[id]/move/route.ts        # Make a move (server-authoritative)
    games/[id]/timeout/route.ts     # Claim timeout
    games/[id]/resign/route.ts      # Resign
    games/[id]/approve/route.ts     # Approve match
    games/[id]/join/route.ts        # Join lobby game
    games/[id]/draw-offer/route.ts  # Draw offer/accept/reject
    games/[id]/rematch/route.ts     # Rematch
    quick-play/route.ts             # Quick play (find or create)

components/
  game/ActiveGame.tsx               # Active chess game UI
  game/ApprovalScreen.tsx           # Match approval screen
  game/WaitingScreen.tsx            # Waiting for opponent
  game/DrawOfferBanner.tsx          # Draw offer notification
  chess/ChessBoard.tsx              # Chess board (react-chessboard)
  chess/PlayerBar.tsx               # Player info + timer
  chess/Timer.tsx                   # Countdown timer (rAF)
  lobby/QuickPlayGrid.tsx           # Quick play bet grid
  lobby/LobbyContent.tsx            # Lobby game list
  lobby/MainTabs.tsx                # Tab navigation
  wallet/WalletInfo.tsx             # Wallet connect + balance
  ui/Avatar.tsx                     # User avatar
  ui/Button.tsx                     # Button component
  ui/Modal.tsx                      # Modal component

lib/
  auth/AuthContext.tsx              # Auth provider (user, session, login)
  auth/session.ts                   # JWT create/verify
  hooks/use-multiplayer-game.ts     # Multiplayer game logic hook
  hooks/use-game-state.ts           # Game state machine hook
  hooks/use-lobby.ts                # Lobby list hook
  hooks/use-api.ts                  # Authenticated fetch wrapper
  hooks/use-game-payment.ts         # On-chain payment hook
  game/broadcast.ts                 # Supabase broadcast helpers
  game/finish.ts                    # Finish game (ELO + payout)
  game/elo.ts                       # ELO calculation
  web3/config.ts                    # Wagmi config
  web3/contracts.ts                 # Contract ABIs + addresses
  web3/send-payout.ts               # On-chain payout functions
  web3/verify-payment.ts            # Verify payment tx
  constants.ts                      # Game constants
```

## Build & Deploy
```bash
npm run build    # Build Next.js
npm run dev      # Dev server (port 3000)
```
Deployed on Vercel: royal-bullet-chess-liard.vercel.app
GitHub: royalbulletchess-bot/royal-bullet-chess

## Coding Conventions
- All components are 'use client' (client-side rendering)
- API routes use `withAuth()` wrapper for authentication
- Use `supabaseAdmin` (service role) in API routes, never client-side supabase for writes
- Use broadcast channels (not postgres_changes) for real-time subscriptions
- Colors: WHITE/BLACK (uppercase strings), not 'w'/'b'
- All text must be in English (no Turkish)

---

# BUGS — Fixed

## FIXED: BUG 1 — Wrong winner gets paid on move-timeout
Used `isCreator` instead of color-based `myColor === 'WHITE'` for winnerId in move/route.ts timeout path.

## FIXED: BUG 2 — BLACK player sees swapped names/avatars
ActiveGame.tsx: top bar always shows opponent, bottom always shows current player regardless of color.

## FIXED: BUG 3 — Server-rejected moves not rolled back
use-multiplayer-game.ts: saves prevFen/prevMoveCount/prevMoveHistory before optimistic apply, reverts on server reject.

## FIXED: BUG 4 — Lobby list shows stale games
use-lobby.ts: replaced postgres_changes (broken due to RLS) with 10-second polling.

## FIXED: BUG 5 — Approval screen has no exit after expiry
ApprovalScreen.tsx: shows "Back to Lobby" button when countdown <= 0.

## FIXED: BUG 6 — Draw offer uses overly complex identity check
ActiveGame.tsx: uses `useAuth()` user.id instead of nested ternary.

## FIXED: BUG 7 — Wallet users show ugly "0X" avatar
Avatar.tsx: detects wallet addresses, shows last 4 chars with gradient background.

## FIXED: BUG 8 — No beforeunload protection during active game
ActiveGame.tsx: adds beforeunload event listener when game is active.

## FIXED: BUG 9 — WaitingScreen has no cancel mechanism
WaitingScreen.tsx + /api/games/[id]/cancel: "Cancel Game" button calls cancel endpoint for OPEN games.

## FIXED: BUG 10 — Game-over page missing ELO change
finish.ts stores creator_elo_change/opponent_elo_change in game record. game-over page displays them.

## FIXED: Both players see "Defeat" (race condition)
- game-over page retries fetch up to 3 times (2s delay) if game.result is null and game is not FINISHED yet.
- Shows "Result is being processed..." if still unavailable after retries.
- move/route.ts timeout path now broadcasts game_update (was missing, only checkmate/draw had it).
- use-multiplayer-game.ts game_update handler always accepts server FINISHED result (removed !gameOverRef.current guard).

## FIXED: Timer 25-second drift between players
use-multiplayer-game.ts new_move handler now syncs the mover's timer with moveData.time_remaining from the server on every opponent move broadcast.

---

# BUGS TO FIX (Remaining)

## BUG 11 — LOW: Share Result doesn't work for browser users
## BUG 12 — LOW: "Play Again" goes to lobby instead of re-queue
## BUG 13 — LOW: No network disconnect detection/recovery
## BUG 14 — LOW: Rematch endpoint needs verification

import type { LobbyGame } from '@/types';

export const MOCK_LOBBY_GAMES: LobbyGame[] = [
  {
    id: '1',
    creator_username: 'vitalik.eth',
    creator_avatar: null,
    bet_amount: 5,
    created_at: new Date(Date.now() - 45_000).toISOString(),
    invite_code: 'abc123',
  },
  {
    id: '2',
    creator_username: 'chess_degen',
    creator_avatar: null,
    bet_amount: 10,
    created_at: new Date(Date.now() - 120_000).toISOString(),
    invite_code: 'def456',
  },
  {
    id: '3',
    creator_username: 'bullet_king',
    creator_avatar: null,
    bet_amount: 1,
    created_at: new Date(Date.now() - 200_000).toISOString(),
    invite_code: 'ghi789',
  },
  {
    id: '4',
    creator_username: 'base_builder',
    creator_avatar: null,
    bet_amount: 2,
    created_at: new Date(Date.now() - 30_000).toISOString(),
    invite_code: 'jkl012',
  },
  {
    id: '5',
    creator_username: 'magnus_fan',
    creator_avatar: null,
    bet_amount: 100,
    created_at: new Date(Date.now() - 90_000).toISOString(),
    invite_code: 'mno345',
  },
];

// Mock current user for Phase 1
export const MOCK_USER = {
  id: 'mock-user-id',
  farcaster_username: 'you',
  farcaster_avatar: null,
  wallet_address: '0x0000000000000000000000000000000000000000',
};

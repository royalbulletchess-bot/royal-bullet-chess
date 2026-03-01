export interface AIDifficulty {
  id: string;
  label: string;
  description: string;
  elo: number;
  skillLevel: number;
  moveTimeMs: number;
  artificialDelayMs: number;
  icon: string;
}

export const AI_DIFFICULTIES: AIDifficulty[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Learning the ropes',
    elo: 1200,
    skillLevel: 0,
    moveTimeMs: 50,
    artificialDelayMs: 800,
    icon: '\u265F', // Pawn
  },
  {
    id: 'casual',
    label: 'Casual',
    description: 'A friendly challenge',
    elo: 1500,
    skillLevel: 3,
    moveTimeMs: 100,
    artificialDelayMs: 600,
    icon: '\u265E', // Knight
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Solid competition',
    elo: 1800,
    skillLevel: 6,
    moveTimeMs: 200,
    artificialDelayMs: 500,
    icon: '\u265D', // Bishop
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Serious play',
    elo: 2200,
    skillLevel: 10,
    moveTimeMs: 400,
    artificialDelayMs: 400,
    icon: '\u265C', // Rook
  },
  {
    id: 'master',
    label: 'Master',
    description: 'Near-perfect engine',
    elo: 2800,
    skillLevel: 18,
    moveTimeMs: 800,
    artificialDelayMs: 300,
    icon: '\u265B', // Queen
  },
];

export const AI_USERNAME = 'Stockfish AI';

export function getDifficultyById(id: string): AIDifficulty | undefined {
  return AI_DIFFICULTIES.find((d) => d.id === id);
}

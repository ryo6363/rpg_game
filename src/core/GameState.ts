import type { JobId } from './types';

// 実行中のゲーム状態。ステップ5で SaveManager がこれを保存・復元する

export interface JobProgress {
  level: number;
  exp: number;
}

export interface GameStateData {
  currentJob: JobId;
  jobs: Record<JobId, JobProgress>;
}

export function createNewState(): GameStateData {
  return {
    currentJob: 'warrior',
    jobs: {
      warrior: { level: 1, exp: 0 },
      mage: { level: 1, exp: 0 },
      hunter: { level: 1, exp: 0 },
    },
  };
}

export const gameState: GameStateData = createNewState();

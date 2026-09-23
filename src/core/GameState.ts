import type { ArmorSlot, ItemInstance, JobId, PlayerStatPoints } from './types';
import { JOBS } from '../data/jobs';
import { createItem } from '../systems/Items';
import { newStatPoints } from '../data/statPoints';

// 実行中のゲーム状態。SaveManager がこれを保存・復元する

export interface JobProgress {
  level: number;
  exp: number;
}

export interface StoryProgress {
  /** 周回数（1 始まり） */
  loop: number;
  /** 今の章 */
  chapter: number;
  /** この周回で立ったフラグ（周回が変わると消える） */
  flags: string[];
}

export interface GameStateData {
  currentJob: JobId;
  jobs: Record<JobId, JobProgress>;
  gold: number;
  /** 持ち物（装備中のものは含まない） */
  inventory: ItemInstance[];
  equipment: {
    /** 武装はジョブごと */
    weapon: Record<JobId, ItemInstance | null>;
    /** 防具・お守りは全ジョブ共通 */
    armor: Record<ArmorSlot, ItemInstance | null>;
  };
  story: StoryProgress;
  /** ステータスポイントと振り分け（レベルと同じくジョブごと） */
  playerStats: Record<JobId, PlayerStatPoints>;
}

export function createNewState(): GameStateData {
  const starter = (job: JobId) => createItem(JOBS[job].starterWeapon, 'normal', 1);
  return {
    currentJob: 'warrior',
    jobs: {
      warrior: { level: 1, exp: 0 },
      mage: { level: 1, exp: 0 },
      hunter: { level: 1, exp: 0 },
    },
    gold: 0,
    inventory: [],
    equipment: {
      weapon: { warrior: starter('warrior'), mage: starter('mage'), hunter: starter('hunter') },
      armor: { head: null, body: null, hands: null, feet: null, accessory: null },
    },
    story: { loop: 1, chapter: 1, flags: [] },
    playerStats: { warrior: newStatPoints(), mage: newStatPoints(), hunter: newStatPoints() },
  };
}

export const gameState: GameStateData = createNewState();

/** 状態を丸ごと置き換える（ロード時） */
export function replaceGameState(data: GameStateData) {
  Object.assign(gameState, data);
}

import { STAT_POINTS } from '../config/balance';
import { createNewState, gameState, replaceGameState, type GameStateData } from './GameState';
import type { JobId, PlayerStatPoints } from './types';

// localStorage への保存。データ構造を変えたら SAVE_VERSION を上げ、
// MIGRATIONS に「旧バージョン → 次のバージョン」の変換を追加する。

const STORAGE_KEY = 'fitquest_save';
export const SAVE_VERSION = 3;

interface SaveFile {
  version: number;
  savedAt: number;
  data: GameStateData;
}

/** MIGRATIONS[n] はバージョン n のデータを n+1 に変換する */
const MIGRATIONS: Record<number, (data: any) => any> = {
  // v1 → v2: ストーリー進行を追加（既存データは1周目・第1章の最初から）
  1: (d) => ({ ...d, story: { loop: 1, chapter: 1, flags: [] } }),
  // v2 → v3: ステータスポイントを追加。今のレベルまでにもらえるはずのポイントを、未使用のまま渡す
  2: (d) => {
    const playerStats: Record<string, PlayerStatPoints> = {};
    for (const [jobId, p] of Object.entries(d.jobs ?? {}) as [string, { level: number }][]) {
      playerStats[jobId] = {
        statPoints: STAT_POINTS.initial + Math.max(0, (p.level ?? 1) - 1) * STAT_POINTS.perLevel,
        allocatedStats: { attack: 0, defense: 0, speed: 0, hp: 0, crit: 0 },
      };
    }
    return { ...d, playerStats };
  },
};

let saveTimer = 0;

export const SaveManager = {
  /** すぐに保存 */
  save() {
    try {
      const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), data: gameState };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch (e) {
      console.warn('[save] failed', e);
    }
  },

  /** 連続した変更をまとめて少し後に保存 */
  requestSave() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => this.save(), 500);
  },

  /** 保存データがあれば読み込む。読み込めたら true */
  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const file = JSON.parse(raw) as SaveFile;
      let data = file.data;
      for (let v = file.version; v < SAVE_VERSION; v++) {
        const migrate = MIGRATIONS[v];
        if (migrate) data = migrate(data);
      }
      // 足りない項目は初期値で補う
      const fresh = createNewState();
      replaceGameState({
        ...fresh,
        ...data,
        jobs: { ...fresh.jobs, ...data.jobs },
        story: { ...fresh.story, ...data.story },
        playerStats: Object.fromEntries(
          (Object.keys(fresh.playerStats) as JobId[]).map((j) => [
            j,
            {
              ...fresh.playerStats[j],
              ...data.playerStats?.[j],
              allocatedStats: { ...fresh.playerStats[j].allocatedStats, ...data.playerStats?.[j]?.allocatedStats },
            },
          ]),
        ) as Record<JobId, PlayerStatPoints>,
        equipment: {
          weapon: { ...fresh.equipment.weapon, ...data.equipment?.weapon },
          armor: { ...fresh.equipment.armor, ...data.equipment?.armor },
        },
      });
      return true;
    } catch (e) {
      console.warn('[save] load failed', e);
      return false;
    }
  },

  exists(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 何もしない */
    }
    replaceGameState(createNewState());
  },
};

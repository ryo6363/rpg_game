import { createNewState, gameState, replaceGameState, type GameStateData } from './GameState';

// localStorage への保存。データ構造を変えたら SAVE_VERSION を上げ、
// MIGRATIONS に「旧バージョン → 次のバージョン」の変換を追加する。

const STORAGE_KEY = 'fitquest_save';
export const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  savedAt: number;
  data: GameStateData;
}

/** MIGRATIONS[n] はバージョン n のデータを n+1 に変換する */
const MIGRATIONS: Record<number, (data: any) => any> = {
  // 例: 1: (d) => ({ ...d, newField: 0 }),
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

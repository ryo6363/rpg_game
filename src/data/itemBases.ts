import type { ItemBaseDef } from '../core/types';

// 装備のベース定義。ここに追加するだけでドロップ候補に入る
// stats はアイテムレベル1時点の値（レベルで伸びる。係数は config/balance.ts の LOOT）

const list: ItemBaseDef[] = [
  // ---- 武装（ジョブごと）
  { id: 'bumper_iron', name: '鉄のバンパー', slot: 'weapon', weaponType: 'bumper', icon: 'icon_bumper', stats: { atk: 4 }, minLevel: 1 },
  { id: 'bumper_spike', name: 'トゲ付きバンパー', slot: 'weapon', weaponType: 'bumper', icon: 'icon_bumper', stats: { atk: 6, critRate: 0.02 }, minLevel: 3 },
  { id: 'engine_small', name: '小型魔導エンジン', slot: 'weapon', weaponType: 'engine', icon: 'icon_engine', stats: { atk: 5 }, minLevel: 1 },
  { id: 'engine_rune', name: 'ルーン魔導エンジン', slot: 'weapon', weaponType: 'engine', icon: 'icon_engine', stats: { atk: 7, critDamage: 0.1 }, minLevel: 3 },
  { id: 'turret_wood', name: '木製ボウガン砲台', slot: 'weapon', weaponType: 'turret', icon: 'icon_turret', stats: { atk: 3, attackSpeed: 0.1 }, minLevel: 1 },
  { id: 'turret_iron', name: '鉄製ボウガン砲台', slot: 'weapon', weaponType: 'turret', icon: 'icon_turret', stats: { atk: 5, attackSpeed: 0.15 }, minLevel: 3 },

  // ---- 防具・お守り（全ジョブ共通）
  { id: 'helmet_leather', name: '革のヘルメット', slot: 'head', icon: 'icon_helmet', stats: { def: 2, maxHp: 5 }, minLevel: 1 },
  { id: 'helmet_iron', name: '鉄のヘルメット', slot: 'head', icon: 'icon_helmet', stats: { def: 4, maxHp: 8 }, minLevel: 3 },
  { id: 'armor_wood', name: '木の装甲板', slot: 'body', icon: 'icon_armor', stats: { def: 4, maxHp: 10 }, minLevel: 1 },
  { id: 'armor_iron', name: '鉄の装甲板', slot: 'body', icon: 'icon_armor', stats: { def: 7, maxHp: 15 }, minLevel: 3 },
  { id: 'handle_leather', name: '革巻きハンドル', slot: 'hands', icon: 'icon_handle', stats: { atk: 1, def: 1 }, minLevel: 1 },
  { id: 'handle_sport', name: 'スポーツハンドル', slot: 'hands', icon: 'icon_handle', stats: { def: 1, attackSpeed: 0.1 }, minLevel: 3 },
  { id: 'tire_normal', name: 'ノーマルタイヤ', slot: 'feet', icon: 'icon_tire', stats: { def: 1, moveSpeed: 3 }, minLevel: 1 },
  { id: 'tire_spike', name: 'スパイクタイヤ', slot: 'feet', icon: 'icon_tire', stats: { def: 2, moveSpeed: 5 }, minLevel: 3 },
  { id: 'charm_safety', name: '交通安全のお守り', slot: 'accessory', icon: 'icon_charm', stats: { maxHp: 10 }, minLevel: 1 },
  { id: 'navi_old', name: '古いカーナビ', slot: 'accessory', icon: 'icon_navi', stats: { critRate: 0.02 }, minLevel: 1 },

  // ---- イベント専用（ランダムドロップには出ない）
  { id: 'varg_fang', name: 'ヴァルグの骨牙', slot: 'accessory', icon: 'icon_fang', stats: { atk: 6, critDamage: 0.2 }, minLevel: 1, unique: true },
];

export const ITEM_BASES: Record<string, ItemBaseDef> = Object.fromEntries(list.map((b) => [b.id, b]));

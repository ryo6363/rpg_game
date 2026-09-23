import type { AffixDef, Slot } from '../core/types';

// 追加効果の定義。ここに追加するだけで抽選候補に入る
// 値 = [min, max] の乱数 + perLevel × (アイテムレベル - 1)

const ALL: Slot[] = ['weapon', 'head', 'body', 'hands', 'feet', 'accessory'];

const list: AffixDef[] = [
  { id: 'atk_flat', stat: 'atk', mode: 'flat', min: 1, max: 3, perLevel: 0.6, slots: ['weapon', 'hands', 'accessory'], weight: 10, prefix: '鋭い' },
  { id: 'atk_pct', stat: 'atk', mode: 'percent', min: 0.04, max: 0.08, perLevel: 0.005, slots: ['weapon', 'accessory'], weight: 6, prefix: '強烈な' },
  { id: 'def_flat', stat: 'def', mode: 'flat', min: 1, max: 3, perLevel: 0.5, slots: ['head', 'body', 'hands', 'feet'], weight: 10, prefix: '頑丈な' },
  { id: 'hp_flat', stat: 'maxHp', mode: 'flat', min: 5, max: 12, perLevel: 3, slots: ALL.filter((s) => s !== 'weapon'), weight: 10, prefix: '丈夫な' },
  { id: 'crit_rate', stat: 'critRate', mode: 'flat', min: 0.01, max: 0.03, perLevel: 0.002, slots: ['weapon', 'head', 'hands', 'accessory'], weight: 6, prefix: '冴えた' },
  { id: 'crit_dmg', stat: 'critDamage', mode: 'flat', min: 0.08, max: 0.15, perLevel: 0.01, slots: ['weapon', 'accessory'], weight: 5, prefix: '痛烈な' },
  { id: 'move_speed', stat: 'moveSpeed', mode: 'percent', min: 0.03, max: 0.06, perLevel: 0.002, slots: ['feet', 'accessory'], weight: 6, prefix: '疾風の' },
  { id: 'atk_speed', stat: 'attackSpeed', mode: 'percent', min: 0.04, max: 0.08, perLevel: 0.003, slots: ['weapon', 'hands', 'accessory'], weight: 6, prefix: '素早い' },
];

export const AFFIXES: Record<string, AffixDef> = Object.fromEntries(list.map((a) => [a.id, a]));

/** レア・レジェンダリーの名前に付く称号 */
export const RARE_TITLES = ['ターボ', 'ニトロ', 'サンダー', 'ブレイズ', 'ストーム', 'シャドウ', 'クローム', 'ドリフト'];
export const LEGENDARY_TITLES = ['伝説の', '覇王の', '流星の', '不滅の'];

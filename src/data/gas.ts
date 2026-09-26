import type { Rarity } from '../core/types';

// 回復アイテム「ガソリン」。レアリティが高いほどたくさん回復する。
// 回復量・ドロップ率・持てる数は config/balance.ts の GAS

export const GAS_ORDER: Rarity[] = ['normal', 'magic', 'rare', 'legendary'];

export const GAS_META: Record<Rarity, { name: string; short: string }> = {
  normal: { name: 'レギュラーガソリン', short: 'レギュラー' },
  magic: { name: 'ハイオクガソリン', short: 'ハイオク' },
  rare: { name: '高純度ガソリン', short: '高純度' },
  legendary: { name: '伝説のガソリン', short: '伝説' },
};

import type { Rarity, Slot, StatKey } from '../core/types';

// 部位・レアリティ・ステータスの表示用情報

export const SLOT_META: Record<Slot, { label: string; icon: string }> = {
  weapon: { label: '武装', icon: 'icon_bumper' },
  head: { label: 'ヘルメット', icon: 'icon_helmet' },
  body: { label: '装甲', icon: 'icon_armor' },
  hands: { label: 'ハンドル', icon: 'icon_handle' },
  feet: { label: 'タイヤ', icon: 'icon_tire' },
  accessory: { label: 'お守り', icon: 'icon_charm' },
};

/** 装備画面での並び順 */
export const SLOT_ORDER: Slot[] = ['weapon', 'head', 'body', 'hands', 'feet', 'accessory'];

/**
 * レアリティの色（文字・枠・ドロップの光で共通）: 白 → 銀 → 金 → 虹
 * rainbow: true なら虹色（color/tint は虹を出せない場所用の代わりの色）
 */
export interface RarityMeta {
  label: string;
  color: string;
  tint: number;
  rainbow: boolean;
  /** 持ち物画面の枠：太さと、金属っぽく見せる明暗（左上が light、右下が dark） */
  frame: { width: 1 | 2; light: number; dark: number };
}

export const RARITY_META: Record<Rarity, RarityMeta> = {
  normal: { label: 'ノーマル', color: '#f4f4f4', tint: 0xf4f4f4, rainbow: false, frame: { width: 1, light: 0xf4f4f4, dark: 0xf4f4f4 } },
  magic: { label: 'マジック', color: '#b8c7dd', tint: 0xa9b8cc, rainbow: false, frame: { width: 2, light: 0xeef3fa, dark: 0x6d7f9a } },
  rare: { label: 'レア', color: '#ffd23f', tint: 0xffd23f, rainbow: false, frame: { width: 2, light: 0xfff1a8, dark: 0xb8860b } },
  legendary: { label: 'レジェンダリー', color: '#ff9ecb', tint: 0xff9ecb, rainbow: true, frame: { width: 2, light: 0xffffff, dark: 0xffffff } },
};

export const RARITY_ORDER: Rarity[] = ['normal', 'magic', 'rare', 'legendary'];

/** fmt: int=整数 / pct=百分率（0.05→5%） / dec=小数1桁 */
export const STAT_META: Record<StatKey, { label: string; short: string; fmt: 'int' | 'pct' | 'dec' }> = {
  maxHp: { label: '最大HP', short: 'HP', fmt: 'int' },
  atk: { label: '攻撃力', short: '攻', fmt: 'int' },
  def: { label: '防御力', short: '防', fmt: 'int' },
  critRate: { label: '会心率', short: '会心', fmt: 'pct' },
  critDamage: { label: '会心ダメージ', short: '会心ダメ', fmt: 'pct' },
  moveSpeed: { label: '移動速度', short: '速', fmt: 'int' },
  attackSpeed: { label: '攻撃速度', short: '攻速', fmt: 'dec' },
};

/** 装備画面に表示するステータスの順 */
export const STAT_ORDER: StatKey[] = ['maxHp', 'atk', 'def', 'critRate', 'critDamage', 'moveSpeed', 'attackSpeed'];

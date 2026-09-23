import Phaser from 'phaser';
import { LOOT } from '../config/balance';
import type { ItemInstance, Rarity, Slot, StatKey, Stats } from '../core/types';
import { AFFIXES, LEGENDARY_TITLES, RARE_TITLES } from '../data/affixes';
import { ITEM_BASES } from '../data/itemBases';
import { STAT_META } from '../data/itemMeta';

// 装備の生成・表示用の共通処理

let uidCounter = 0;
const newUid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 重み付き抽選 */
export function weightedPick<T>(entries: readonly T[], weight: (e: T) => number): T | undefined {
  const total = entries.reduce((s, e) => s + weight(e), 0);
  if (total <= 0) return undefined;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= weight(e);
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

/** ベースとレアリティを指定して装備を1つ作る */
export function createItem(baseId: string, rarity: Rarity, itemLevel: number): ItemInstance {
  const base = ITEM_BASES[baseId];

  // 基本性能
  const mul = LOOT.baseStatMultiplier[rarity] * (1 + (itemLevel - 1) * LOOT.baseStatPerLevel);
  const stats: Partial<Stats> = {};
  for (const [k, v] of Object.entries(base.stats) as [StatKey, number][]) {
    stats[k] = roundStat(k, v * mul);
  }

  // 追加効果（同じ効果は重複しない）
  const [minN, maxN] = LOOT.affixCount[rarity];
  const count = Phaser.Math.Between(minN, maxN);
  const pool = Object.values(AFFIXES).filter((a) => a.slots.includes(base.slot));
  const affixes: ItemInstance['affixes'] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const a = weightedPick(pool, (x) => x.weight)!;
    pool.splice(pool.indexOf(a), 1);
    const lv = itemLevel - 1;
    const raw = Phaser.Math.FloatBetween(a.min + a.perLevel * lv, a.max + a.perLevel * lv);
    affixes.push({ id: a.id, value: a.mode === 'percent' ? round(raw, 3) : roundStat(a.stat, raw) });
  }

  // 名前
  let name = base.name;
  if (rarity === 'magic' && affixes[0]) name = AFFIXES[affixes[0].id].prefix + base.name;
  if (rarity === 'rare') name = `${pick(RARE_TITLES)}・${base.name}`;
  if (rarity === 'legendary') name = pick(LEGENDARY_TITLES) + base.name;

  return { uid: newUid(), baseId, rarity, itemLevel, name, stats, affixes, upgrade: 0 };
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

function roundStat(stat: StatKey, v: number): number {
  const fmt = STAT_META[stat].fmt;
  if (fmt === 'int') return Math.max(1, Math.round(v));
  if (fmt === 'pct') return round(v, 3);
  return round(v, 2);
}

export function itemSlot(item: ItemInstance): Slot {
  return ITEM_BASES[item.baseId].slot;
}

export function sellPrice(item: ItemInstance): number {
  return Math.round(LOOT.sellBase[item.rarity] * (1 + item.itemLevel * LOOT.sellPerLevel));
}

/** ステータス値を表示用の文字列に */
export function formatStat(stat: StatKey, value: number, signed = false): string {
  const fmt = STAT_META[stat].fmt;
  const sign = signed && value > 0 ? '+' : '';
  if (fmt === 'pct') return `${sign}${round(value * 100, 1)}%`;
  if (fmt === 'dec') return `${sign}${round(value, 2)}`;
  return `${sign}${Math.round(value)}`;
}

/** 装備の性能を表示用の行にする */
export function itemLines(item: ItemInstance): { text: string; color: string }[] {
  const lines: { text: string; color: string }[] = [];
  for (const [k, v] of Object.entries(item.stats) as [StatKey, number][]) {
    lines.push({ text: `${STAT_META[k].label} ${formatStat(k, v, true)}`, color: '#f4f4f4' });
  }
  for (const a of item.affixes) {
    const def = AFFIXES[a.id];
    const val = def.mode === 'percent' ? `+${round(a.value * 100, 1)}%` : formatStat(def.stat, a.value, true);
    lines.push({ text: `${STAT_META[def.stat].label} ${val}`, color: '#41a6f6' });
  }
  return lines;
}

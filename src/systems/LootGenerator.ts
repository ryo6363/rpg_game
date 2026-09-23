import { LOOT } from '../config/balance';
import type { ItemInstance, JobId, Rarity, Slot } from '../core/types';
import { ITEM_BASES } from '../data/itemBases';
import { JOBS } from '../data/jobs';
import { createItem, weightedPick } from './Items';

// 敵のドロップ判定

export interface DropContext {
  itemLevel: number;
  jobId: JobId;
  /** 敵ごとのドロップ率倍率 */
  dropRate?: number;
  /** レア以上の出やすさ倍率（難易度などで上がる） */
  rarityBonus?: number;
}

export function rollRarity(rarityBonus = 1): Rarity {
  const w = LOOT.rarityWeights;
  const entries: [Rarity, number][] = [
    ['normal', w.normal],
    ['magic', w.magic * rarityBonus],
    ['rare', w.rare * rarityBonus],
    ['legendary', w.legendary * rarityBonus],
  ];
  return weightedPick(entries, (e) => e[1])![0];
}

/** ドロップしなければ null */
export function rollDrop(ctx: DropContext): ItemInstance | null {
  if (Math.random() >= LOOT.dropChance * (ctx.dropRate ?? 1)) return null;

  const slot = weightedPick(Object.keys(LOOT.slotWeights) as Slot[], (s) => LOOT.slotWeights[s])!;
  let candidates = Object.values(ITEM_BASES).filter((b) => b.slot === slot && b.minLevel <= ctx.itemLevel);
  if (slot === 'weapon' && Math.random() < LOOT.currentJobWeaponChance) {
    const wt = JOBS[ctx.jobId].weaponType;
    const own = candidates.filter((b) => b.weaponType === wt);
    if (own.length > 0) candidates = own;
  }
  // 高レベルのベースほど少し出やすく
  const base = weightedPick(candidates, (b) => 1 + b.minLevel * 0.5);
  if (!base) return null;
  return createItem(base.id, rollRarity(ctx.rarityBonus), ctx.itemLevel);
}

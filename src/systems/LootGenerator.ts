import { LOOT } from '../config/balance';
import { gameState } from '../core/GameState';
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
  return createRandomItem(ctx);
}

/** ランダムな装備を1つ作る。minRarity 未満のレアリティは引き直す（ボスの確定ドロップ用） */
export function createRandomItem(ctx: DropContext, minRarity: Rarity = 'normal'): ItemInstance | null {
  const slot = weightedPick(Object.keys(LOOT.slotWeights) as Slot[], (s) => LOOT.slotWeights[s])!;
  // 2周目以降だけの装備（minLoop）は、その周回から候補に入る
  const loop = gameState.story.loop;
  let candidates = Object.values(ITEM_BASES).filter(
    (b) => b.slot === slot && !b.unique && b.minLevel <= ctx.itemLevel && (b.minLoop ?? 1) <= loop,
  );
  if (slot === 'weapon' && Math.random() < LOOT.currentJobWeaponChance) {
    const wt = JOBS[ctx.jobId].weaponType;
    const own = candidates.filter((b) => b.weaponType === wt);
    if (own.length > 0) candidates = own;
  }
  // 高レベルのベースほど少し出やすく
  const base = weightedPick(candidates, (b) => 1 + b.minLevel * 0.5);
  if (!base) return null;
  let rarity = rollRarity(ctx.rarityBonus);
  const order: Rarity[] = ['normal', 'magic', 'rare', 'legendary'];
  if (order.indexOf(rarity) < order.indexOf(minRarity)) rarity = minRarity;
  return createItem(base.id, rarity, ctx.itemLevel, loop);
}

import { STAT_POINT_VALUES } from '../config/balance';
import type { ItemInstance, JobId, StatAllocKey, StatAllocation, Stats, StatKey } from '../core/types';
import { AFFIXES } from '../data/affixes';
import { JOBS } from '../data/jobs';
import { STAT_ALLOC_META } from '../data/statPoints';
import { itemStats } from './Items';

/**
 * ステータスポイントによる補正（装備とは別枠）。
 * pct = 割合の上昇、add = そのまま足す値。
 * 将来「特定の項目に一定数振ると追加効果」を入れるときは、ここに足す
 */
export function allocationModifiers(alloc: StatAllocation): {
  pct: Partial<Record<StatKey, number>>;
  add: Partial<Record<StatKey, number>>;
} {
  const pct: Partial<Record<StatKey, number>> = {};
  const add: Partial<Record<StatKey, number>> = {};
  for (const key of Object.keys(alloc) as StatAllocKey[]) {
    const points = alloc[key] ?? 0;
    if (points <= 0) continue;
    const meta = STAT_ALLOC_META[key];
    const target = meta.mode === 'pct' ? pct : add;
    target[meta.stat] = (target[meta.stat] ?? 0) + points * STAT_POINT_VALUES[key];
  }
  return { pct, add };
}

/** 振ったポイント + ジョブの得意分野（戦士：防御力 +10 など） */
export function withJobBonus(jobId: JobId, alloc?: StatAllocation): StatAllocation {
  const out: StatAllocation = { attack: 0, defense: 0, speed: 0, hp: 0, crit: 0, ...alloc };
  for (const [k, v] of Object.entries(JOBS[jobId].statBonus) as [StatAllocKey, number][]) out[k] += v;
  return out;
}

/**
 * 最終ステータスの計算（ここ1か所に集約）
 *   (ジョブ基礎 + Lv成長 + 装備の足し算) × (1 + 装備の%上昇) × (1 + ステータスポイントの%上昇)
 *   ＋ ステータスポイントの足し算（会心率）
 * スキルのバフ・パッシブは、この結果に Player 側で掛ける
 */
export function calcPlayerStats(
  jobId: JobId,
  level: number,
  equipped: readonly ItemInstance[] = [],
  alloc?: StatAllocation,
): Stats {
  const job = JOBS[jobId];
  const stats: Stats = { ...job.base };
  const lv = Math.max(0, level - 1);
  for (const key of Object.keys(job.growth) as StatKey[]) {
    stats[key] += (job.growth[key] ?? 0) * lv;
  }

  const pct: Partial<Record<StatKey, number>> = {};
  for (const item of equipped) {
    for (const [k, v] of Object.entries(itemStats(item)) as [StatKey, number][]) stats[k] += v;
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def || def.skill) continue;
      if (def.mode === 'flat') stats[def.stat] += a.value;
      else pct[def.stat] = (pct[def.stat] ?? 0) + a.value;
    }
  }
  for (const [k, v] of Object.entries(pct) as [StatKey, number][]) stats[k] *= 1 + v;

  // ステータスポイント（ジョブの得意分野の Lv も足す）
  {
    const mod = allocationModifiers(withJobBonus(jobId, alloc));
    for (const [k, v] of Object.entries(mod.pct) as [StatKey, number][]) stats[k] *= 1 + v;
    for (const [k, v] of Object.entries(mod.add) as [StatKey, number][]) stats[k] += v;
  }

  stats.maxHp = Math.round(stats.maxHp);
  stats.atk = Math.round(stats.atk);
  stats.def = Math.round(stats.def);
  return stats;
}

import type { ItemInstance, JobId, Stats, StatKey } from '../core/types';
import { AFFIXES } from '../data/affixes';
import { JOBS } from '../data/jobs';

/**
 * 最終ステータス = (ジョブ基礎 + Lv成長 + 装備の足し算) × (1 + 装備の%上昇)
 */
export function calcPlayerStats(jobId: JobId, level: number, equipped: readonly ItemInstance[] = []): Stats {
  const job = JOBS[jobId];
  const stats: Stats = { ...job.base };
  const lv = Math.max(0, level - 1);
  for (const key of Object.keys(job.growth) as StatKey[]) {
    stats[key] += (job.growth[key] ?? 0) * lv;
  }

  const pct: Partial<Record<StatKey, number>> = {};
  for (const item of equipped) {
    for (const [k, v] of Object.entries(item.stats) as [StatKey, number][]) stats[k] += v;
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def) continue;
      if (def.mode === 'flat') stats[def.stat] += a.value;
      else pct[def.stat] = (pct[def.stat] ?? 0) + a.value;
    }
  }
  for (const [k, v] of Object.entries(pct) as [StatKey, number][]) stats[k] *= 1 + v;

  stats.maxHp = Math.round(stats.maxHp);
  stats.atk = Math.round(stats.atk);
  stats.def = Math.round(stats.def);
  return stats;
}

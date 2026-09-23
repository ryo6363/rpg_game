import type { JobId, Stats, StatKey } from '../core/types';
import { JOBS } from '../data/jobs';

/** ジョブ基礎値 + レベル成長 → 最終ステータス（ステップ2で装備を加算） */
export function calcPlayerStats(jobId: JobId, level: number): Stats {
  const job = JOBS[jobId];
  const stats: Stats = { ...job.base };
  const lv = Math.max(0, level - 1);
  for (const key of Object.keys(job.growth) as StatKey[]) {
    stats[key] += (job.growth[key] ?? 0) * lv;
  }
  stats.maxHp = Math.round(stats.maxHp);
  return stats;
}

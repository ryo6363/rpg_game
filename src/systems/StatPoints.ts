import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import type { JobId, PlayerStatPoints, StatAllocKey, StatAllocation } from '../core/types';
import { STAT_POINTS } from '../config/balance';

// ステータスポイント（ジョブごと）。レベルが上がるともらえ、好きな項目に振り分けて恒久的に強化する。
// 将来の拡張（振り直しアイテム・リセット・一定数振ったときの追加効果など）はこのファイルと
// systems/StatCalculator.ts の allocationModifiers に足す。

export function statPointsOf(jobId: JobId = gameState.currentJob): PlayerStatPoints {
  return gameState.playerStats[jobId];
}

/** 振り分け状況（ステータス計算用） */
export function allocationOf(jobId: JobId = gameState.currentJob): StatAllocation {
  return gameState.playerStats[jobId].allocatedStats;
}

/** レベルアップでポイントを得る（上がったレベル数ぶん） */
export function grantStatPoints(levels: number, jobId: JobId = gameState.currentJob): number {
  const gained = levels * STAT_POINTS.perLevel;
  gameState.playerStats[jobId].statPoints += gained;
  return gained;
}

/** 1ポイント使って key を1段階強化する。未使用ポイントがなければ false */
export function allocateStatPoint(key: StatAllocKey, jobId: JobId = gameState.currentJob): boolean {
  const ps = gameState.playerStats[jobId];
  if (ps.statPoints <= 0) return false;
  ps.statPoints--;
  ps.allocatedStats[key]++;
  EventBus.emit(GameEvents.StatsChanged);
  SaveManager.requestSave();
  return true;
}

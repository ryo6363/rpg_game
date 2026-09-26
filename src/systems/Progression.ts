import { DEATH, EXP } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { grantStatPoints } from './StatPoints';

// 経験値とレベル（ジョブごと）

export function expToNext(level: number): number {
  return Math.round(EXP.base * Math.pow(level, EXP.exponent));
}

/** 経験値を加える。上がったレベル数を返す */
export function gainExp(amount: number): number {
  const job = gameState.jobs[gameState.currentJob];
  let ups = 0;
  if (job.level >= EXP.maxLevel) return 0;
  job.exp += Math.round(amount);
  while (job.level < EXP.maxLevel && job.exp >= expToNext(job.level)) {
    job.exp -= expToNext(job.level);
    job.level++;
    ups++;
  }
  if (job.level >= EXP.maxLevel) job.exp = 0;
  EventBus.emit(GameEvents.ExpChanged);
  if (ups > 0) {
    // 上がったレベルの数だけステータスポイント（Lv10 → Lv13 なら +3）
    const points = grantStatPoints(ups);
    EventBus.emit(GameEvents.LevelUp, job.level, points);
    SaveManager.requestSave();
  }
  return ups;
}

/** やられたとき：次のレベルまでに必要な経験値の一部を失う（レベルは下がらない）。失った量を返す */
export function loseExpOnDeath(): number {
  const job = gameState.jobs[gameState.currentJob];
  if (job.level >= EXP.maxLevel) return 0;
  const lost = Math.min(job.exp, Math.round(expToNext(job.level) * DEATH.expLossRatio));
  job.exp -= lost;
  EventBus.emit(GameEvents.ExpChanged);
  SaveManager.requestSave();
  return lost;
}

/** 敵を倒したときの経験値 */
export function killExp(baseExp: number, areaLevel: number): number {
  return baseExp * (1 + (areaLevel - 1) * EXP.perAreaLevel);
}

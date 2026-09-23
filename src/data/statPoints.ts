import { STAT_POINT_VALUES, STAT_POINTS } from '../config/balance';
import type { PlayerStatPoints, StatAllocKey, StatAllocation, StatKey } from '../core/types';

// ステータスポイントで強化できる項目の表示名と、どのステータスに効くか。
// 1ポイントあたりの上昇量は config/balance.ts の STAT_POINT_VALUES

export const STAT_ALLOC_ORDER: StatAllocKey[] = ['attack', 'defense', 'speed', 'hp', 'crit'];

export const STAT_ALLOC_META: Record<
  StatAllocKey,
  {
    label: string;
    /** 効くステータス */
    stat: StatKey;
    /** pct = 割合で上がる（×(1+値)）/ add = そのまま足す（会心率） */
    mode: 'pct' | 'add';
  }
> = {
  attack: { label: '攻撃力', stat: 'atk', mode: 'pct' },
  defense: { label: '防御力', stat: 'def', mode: 'pct' },
  speed: { label: '速度', stat: 'moveSpeed', mode: 'pct' },
  hp: { label: 'HPアップ', stat: 'maxHp', mode: 'pct' },
  crit: { label: '会心率', stat: 'critRate', mode: 'add' },
};

/** 振ったポイントによる上昇の表示（例: "+30%" / "+2.5%"） */
export function allocationBonusText(key: StatAllocKey, points: number): string {
  const v = STAT_POINT_VALUES[key] * points * 100;
  return `+${Math.round(v * 10) / 10}%`;
}

/** 何も振っていない状態 */
export function emptyAllocation(): StatAllocation {
  return { attack: 0, defense: 0, speed: 0, hp: 0, crit: 0 };
}

/** そのレベルまでにもらえるポイントの合計（Lv1 = 1、Lv50 = 50） */
export function totalPointsForLevel(level: number): number {
  return STAT_POINTS.initial + Math.max(0, level - 1) * STAT_POINTS.perLevel;
}

/** 新しいジョブの初期状態（Lv1 のポイントだけ持っている） */
export function newStatPoints(): PlayerStatPoints {
  return { statPoints: STAT_POINTS.initial, allocatedStats: emptyAllocation() };
}

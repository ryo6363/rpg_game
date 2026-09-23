import { COMBAT } from '../config/balance';

export interface DamageResult {
  amount: number;
  crit: boolean;
}

export interface AttackerInfo {
  atk: number;
  critRate: number;
  critDamage: number;
}

/** ダメージ計算。power はスキル倍率 */
export function rollDamage(attacker: AttackerInfo, power: number, targetDef: number): DamageResult {
  const base = attacker.atk * power;
  const reduced = (base * COMBAT.defenseK) / (COMBAT.defenseK + Math.max(0, targetDef));
  const variance = 1 + (Math.random() * 2 - 1) * COMBAT.variance;
  const crit = Math.random() < attacker.critRate;
  const critMul = crit ? COMBAT.baseCritMultiplier + attacker.critDamage : 1;
  return { amount: Math.max(1, Math.round(reduced * variance * critMul)), crit };
}

import type { EnemyDef } from '../core/types';

// 敵定義。ai の種類ごとの動きは systems/EnemyAI.ts
export const ENEMIES: Record<string, EnemyDef> = {
  slime: {
    id: 'slime',
    name: 'スライム',
    sprite: 'slime',
    ai: 'melee',
    hp: 30,
    atk: 9,
    def: 2,
    moveSpeed: 30,
    aggroRange: 90,
    attackRange: 13,
    windup: 0.45,
    recover: 0.6,
    bodyRadius: 6,
    exp: 5,
  },
};

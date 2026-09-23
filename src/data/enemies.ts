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
    attackRange: 16,
    // 前方への体当たり。予兆（直線）を見てから横に避けられる
    attack: { shape: { type: 'line', length: 30, width: 14 }, windup: 0.8, lunge: 150 },
    recover: 0.6,
    bodyRadius: 6,
    exp: 5,
  },
};

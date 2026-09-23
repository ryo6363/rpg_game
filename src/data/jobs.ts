import type { JobDef, JobId } from '../core/types';

// ジョブ定義。スキルは data/skills.ts の id を参照
export const JOBS: Record<JobId, JobDef> = {
  warrior: {
    id: 'warrior',
    name: '戦士',
    weaponType: 'bumper',
    starterWeapon: 'bumper_iron',
    sprite: 'car_warrior',
    base: { maxHp: 120, atk: 12, def: 8, critRate: 0.05, critDamage: 0, moveSpeed: 62, attackSpeed: 2.2 },
    growth: { maxHp: 14, atk: 2, def: 1.2 },
    basicAttack: 'warrior_slash',
    skills: [],
  },
  // 魔法使い・狩人はステップ3で本実装（見た目・攻撃は仮）
  mage: {
    id: 'mage',
    name: '魔法使い',
    weaponType: 'engine',
    starterWeapon: 'engine_small',
    sprite: 'car_mage',
    base: { maxHp: 80, atk: 14, def: 3, critRate: 0.05, critDamage: 0, moveSpeed: 58, attackSpeed: 1.4 },
    growth: { maxHp: 9, atk: 2.4, def: 0.6 },
    basicAttack: 'warrior_slash',
    skills: [],
  },
  hunter: {
    id: 'hunter',
    name: '狩人',
    weaponType: 'turret',
    starterWeapon: 'turret_wood',
    sprite: 'car_hunter',
    base: { maxHp: 90, atk: 9, def: 4, critRate: 0.1, critDamage: 0, moveSpeed: 68, attackSpeed: 3.0 },
    growth: { maxHp: 10, atk: 1.6, def: 0.8 },
    basicAttack: 'warrior_slash',
    skills: [],
  },
};

import type { JobDef, JobId } from '../core/types';

// ジョブ定義。スキルは data/skills.ts の id を参照
export const JOBS: Record<JobId, JobDef> = {
  warrior: {
    id: 'warrior',
    name: '戦士',
    description: '頑丈な車体で体当たり。近接戦が得意',
    weaponType: 'bumper',
    starterWeapon: 'bumper_iron',
    sprite: 'car_warrior',
    base: { maxHp: 120, atk: 12, def: 8, critRate: 0.05, critDamage: 0, moveSpeed: 62, attackSpeed: 2.2 },
    growth: { maxHp: 14, atk: 2, def: 1.2 },
    basicAttack: 'warrior_slash',
    skills: [
      { id: 'warrior_tackle', unlockLevel: 1 },
      { id: 'warrior_spin', unlockLevel: 3 },
      { id: 'warrior_nitro', unlockLevel: 6 },
    ],
  },
  mage: {
    id: 'mage',
    name: '魔法使い',
    description: '魔導エンジンで範囲魔法。遠くからまとめて攻撃',
    weaponType: 'engine',
    starterWeapon: 'engine_small',
    sprite: 'car_mage',
    base: { maxHp: 80, atk: 14, def: 3, critRate: 0.05, critDamage: 0, moveSpeed: 58, attackSpeed: 1.4 },
    growth: { maxHp: 9, atk: 2.4, def: 0.6 },
    basicAttack: 'mage_orb',
    skills: [
      { id: 'mage_flame', unlockLevel: 1 },
      { id: 'mage_scatter', unlockLevel: 3 },
      { id: 'mage_thunder', unlockLevel: 6 },
    ],
  },
  hunter: {
    id: 'hunter',
    name: '狩人',
    description: 'ボウガン砲台で高速連射。素早く動ける',
    weaponType: 'turret',
    starterWeapon: 'turret_wood',
    sprite: 'car_hunter',
    base: { maxHp: 90, atk: 9, def: 4, critRate: 0.1, critDamage: 0, moveSpeed: 68, attackSpeed: 3.0 },
    growth: { maxHp: 10, atk: 1.6, def: 0.8 },
    basicAttack: 'hunter_bolt',
    skills: [
      { id: 'hunter_triple', unlockLevel: 1 },
      { id: 'hunter_pierce', unlockLevel: 3 },
      { id: 'hunter_rain', unlockLevel: 6 },
    ],
  },
};

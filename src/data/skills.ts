import type { SkillDef } from '../core/types';

// スキル定義。kind ごとの実際の処理は systems/SkillRunner.ts
export const SKILLS: Record<string, SkillDef> = {
  warrior_slash: {
    id: 'warrior_slash',
    name: '斬撃',
    kind: 'meleeArc',
    power: 1.0,
    cooldown: 0,
    range: 24,
    arc: 150,
    effect: 'fx_slash',
  },
};

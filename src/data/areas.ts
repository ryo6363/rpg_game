import type { AreaDef } from '../core/types';

// エリア定義（ステップ4で章構成 chapters.ts と結びつける）
export const AREAS: Record<string, AreaDef> = {
  ch1_field1: {
    id: 'ch1_field1',
    name: 'はじまりの草原',
    map: 'ch1_field1',
    level: 1,
    maxEnemies: 14,
    enemies: [{ id: 'slime', weight: 1 }],
  },
};

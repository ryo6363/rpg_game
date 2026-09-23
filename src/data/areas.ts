import type { AreaDef } from '../core/types';

// エリア定義（ステップ4で章構成 chapters.ts と結びつける）
// exits の char はマップ上の文字。踏むと to のエリアへ移動し、arrive の文字の位置に出る

export const AREAS: Record<string, AreaDef> = {
  town: {
    id: 'town',
    name: 'はじまりの町',
    type: 'town',
    map: 'town',
    floor: ':',
    level: 1,
    maxEnemies: 0,
    enemies: [],
    exits: [{ char: '^', to: 'ch1_field1', arrive: '@' }],
    npcs: [
      {
        id: 'garage',
        name: 'ガレージの親方',
        sprite: 'npc_garage',
        marker: 'g',
        action: 'jobChange',
        lines: ['よう！ 今日はどの車で出るんだ？'],
      },
      {
        id: 'mechanic',
        name: '整備士',
        sprite: 'npc_mechanic',
        marker: 'm',
        action: 'upgrade',
        lines: ['パーツの強化ならまかせて！ ゴールドはもらうけどね。'],
      },
      {
        id: 'guide',
        name: '案内人',
        sprite: 'npc_guide',
        marker: 'n',
        action: 'talk',
        lines: ['北の門を出ると「はじまりの草原」だよ。', 'スライムに気をつけてね！'],
      },
    ],
  },
  ch1_field1: {
    id: 'ch1_field1',
    name: 'はじまりの草原',
    type: 'field',
    map: 'ch1_field1',
    floor: '.',
    level: 1,
    maxEnemies: 14,
    enemies: [{ id: 'slime', weight: 1 }],
    exits: [{ char: '_', to: 'town', arrive: 's' }],
  },
};

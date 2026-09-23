import type { AreaDef } from '../core/types';

// エリア定義。exits の char はマップ上の文字。踏むと to のエリアへ移動し、arrive の文字の位置に出る。
// level は1周目の敵レベル（周回ごとに config/balance.ts の LOOP.levelPerLoop が加わる）

export const AREAS: Record<string, AreaDef> = {
  // ---------------------------------------------------------------- 第1章
  town: {
    id: 'town',
    name: 'はじまりの街',
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
        lines: [{ s: '親方', t: 'どの車で出る？ レベルは車ごとに別だからな。' }],
      },
      {
        id: 'mechanic',
        name: '整備士',
        sprite: 'npc_mechanic',
        marker: 'm',
        action: 'upgrade',
        lines: [{ s: '整備士', t: 'パーツの強化ならまかせて！ ゴールドはもらうけどね。' }],
      },
      {
        id: 'villager',
        name: '住民',
        sprite: 'npc_villager',
        marker: 'v',
        action: 'talk',
        lines: [
          { s: '住民', t: '最近、森の奥でモンスターが増えてるんだって。' },
          { s: '住民', t: 'しかも変なの。森から「街のほう」へ向かってくるんだよ。' },
          { s: '住民', t: 'ふつうは森の奥へ逃げるはずなのにね……。' },
        ],
      },
      {
        id: 'guide',
        name: '案内人',
        sprite: 'npc_guide',
        marker: 'n',
        action: 'talk',
        lines: [
          { s: '案内人', t: '北の門を出ると「はじまりの森」だよ。' },
          { s: '案内人', t: '森を北へ抜けると「旧道」。その奥には……近づかないほうがいい。' },
          { s: '案内人', t: '周回を重ねるほど、森のモンスターは強くなる。……なんでそう思ったんだろう？', minLoop: 2 },
        ],
      },
    ],
  },
  ch1_field1: {
    id: 'ch1_field1',
    name: 'はじまりの森',
    type: 'field',
    map: 'ch1_field1',
    floor: '.',
    level: 1,
    maxEnemies: 14,
    enemies: [
      { id: 'slime', weight: 5 },
      { id: 'wolf', weight: 3 },
      { id: 'poison_flower', weight: 2 },
    ],
    exits: [
      { char: '_', to: 'town', arrive: 's' },
      { char: '^', to: 'ch1_field2', arrive: '@' },
    ],
  },
  ch1_field2: {
    id: 'ch1_field2',
    name: '森の旧道',
    type: 'field',
    map: 'ch1_field2',
    floor: '.',
    level: 3,
    maxEnemies: 14,
    enemies: [
      { id: 'slime', weight: 2 },
      { id: 'wolf', weight: 3 },
      { id: 'goblin_rider', weight: 3 },
      { id: 'poison_flower', weight: 2 },
      { id: 'treant', weight: 1 },
    ],
    exits: [
      { char: '_', to: 'ch1_field1', arrive: 'n' },
      { char: '^', to: 'ch1_boss', arrive: '@' },
    ],
    objects: [
      { id: 'wreck', sprite: 'car_wreck', marker: 'W' },
      { id: 'zero_sign', sprite: 'sign_zero', marker: 'Z', minLoop: 10 },
    ],
  },
  ch1_boss: {
    id: 'ch1_boss',
    name: '森の最奥',
    type: 'field',
    map: 'ch1_boss',
    floor: '.',
    level: 5,
    maxEnemies: 0,
    enemies: [],
    exits: [{ char: '_', to: 'ch1_field2', arrive: 'b' }],
    boss: { id: 'varg', marker: 'B' },
  },
};

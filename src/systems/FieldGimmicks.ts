import Phaser from 'phaser';
import { DISPLAY } from '../config/balance';
import type { FieldGimmickDef } from '../core/types';
import { TILE_TYPES } from '../data/tiles';
import type { CombatWorld } from './CombatWorld';
import { spawnBossEcho } from './EnemyAI';

/**
 * 最終章のフィールドのしかけ（壊れた時間の演出）。
 * - 道路の一部が突然消える（予兆つき）
 * - 過去の章の景色が一定時間だけ浮かび上がる
 * - 過去のボスの技が突然発生する
 * - 空中に過去の景色のかけらが浮かぶ（飾り）
 */

/** 過去の章の景色（タイルの文字で描く小さな島） */
const PAST_SCENES: { name: string; rows: string[] }[] = [
  { name: 'はじまりの森', rows: ['.T,T.', 'T.*.T', ',.=.,', 'T.,.T'] },
  { name: '灰の都', rows: ['KUUK;', 'K;;K;', ';;;;;', 'AALAA'] },
  { name: '沈没都市', rows: ['~%%!~', '%&&%%', '~%+%~', '%%~%%'] },
  { name: '終焉王国', rows: ['YJYYJ', 'ZNNZZ', 'ZNNZZ', 'YZZJY'] },
];

const charIndex = new Map(TILE_TYPES.map((t, i) => [t.char, i]));

/** 小さなタイルの島を作る（見た目だけ。当たり判定なし） */
export function makeTilePatch(scene: Phaser.Scene, rows: string[], x: number, y: number): Phaser.Tilemaps.TilemapLayer {
  const ts = DISPLAY.tileSize;
  const data = rows.map((r) => [...r].map((ch) => charIndex.get(ch) ?? 0));
  const map = scene.make.tilemap({ data, tileWidth: ts, tileHeight: ts });
  const tileset = map.addTilesetImage('tiles', 'tiles', ts, ts, 0, 0)!;
  return map.createLayer(0, tileset, x, y)!;
}

/** 過去の景色が一定時間だけ浮かび上がる（半透明・当たり判定なし） */
export function memoryFlash(world: CombatWorld, x: number, y: number, duration: number, label = true, sceneIndex?: number) {
  const scene = world.gameScene;
  const ts = DISPLAY.tileSize;
  const past = PAST_SCENES[sceneIndex ?? Math.floor(Math.random() * PAST_SCENES.length)];
  const w = past.rows[0].length * ts;
  const h = past.rows.length * ts;
  const layer = makeTilePatch(scene, past.rows, x - w / 2, y - h / 2).setDepth(-9000).setAlpha(0);
  scene.tweens.add({
    targets: layer,
    alpha: 0.5,
    duration: 400,
    yoyo: true,
    hold: duration * 1000,
    onComplete: () => layer.destroy(),
  });
  if (label) world.showSpeech(x, y - h / 2 - 2, `――${past.name}の記憶`);
}

export interface GimmickHost extends CombatWorld {
  /** 歩ける場所か（壁・穴・出入口でない） */
  isWalkableFloor(x: number, y: number): boolean;
  /** 空中の何もない場所（飾りを浮かべる）の候補 */
  voidSpots(): { x: number; y: number }[];
  /** フィールドのしかけのダメージの強さ（エリアのレベルに合わせる） */
  gimmickPower(): number;
}

export class FieldGimmicks {
  private cfg: FieldGimmickDef;
  private timers = { vanish: 2, memory: 4, echo: 5 };

  constructor(
    private host: GimmickHost,
    cfg: FieldGimmickDef,
  ) {
    this.cfg = { ...cfg };
    if (cfg.fragments) this.placeFragments(cfg.fragments);
  }

  /** しかけを追加・変更する（ZERO の「最後の記憶」など） */
  setConfig(cfg: FieldGimmickDef) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  update(dt: number) {
    const p = this.host.player;
    if (p.dead) return;
    const { vanish, memory, echo } = this.cfg;
    if (vanish && (this.timers.vanish -= dt) <= 0) {
      this.timers.vanish = vanish.interval * (0.7 + Math.random() * 0.6);
      this.spawnVanish();
    }
    if (memory && (this.timers.memory -= dt) <= 0) {
      this.timers.memory = memory.interval * (0.7 + Math.random() * 0.6);
      const a = Math.random() * Math.PI * 2;
      memoryFlash(this.host, p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 50, memory.duration, memory.label ?? true);
    }
    if (echo && (this.timers.echo -= dt) <= 0) {
      this.timers.echo = echo.interval * (0.7 + Math.random() * 0.6);
      const entry = echo.pool[Math.floor(Math.random() * echo.pool.length)];
      spawnBossEcho(this.host, entry, this.host.gimmickPower(), { x: p.x, y: p.y, r: 90 });
    }
  }

  /** プレイヤーの近くの道路が消える */
  private spawnVanish() {
    const v = this.cfg.vanish!;
    const p = this.host.player;
    const ts = DISPLAY.tileSize;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 20 + Math.random() * 70;
      // タイルの格子にそろえる
      const x = Math.floor((p.x + Math.cos(a) * d) / ts) * ts + ts / 2;
      const y = Math.floor((p.y + Math.sin(a) * d) / ts) * ts + ts / 2;
      const half = v.size / 2 - 4;
      const ok = [
        [x, y],
        [x - half, y - half],
        [x + half, y - half],
        [x - half, y + half],
        [x + half, y + half],
      ].every(([cx, cy]) => this.host.isWalkableFloor(cx, cy));
      if (!ok) continue;
      this.host.spawnPit(x, y, v.size, v.size, v.warn, v.duration, !!v.lethal, this.host.gimmickPower());
      return;
    }
  }

  /** 空中に過去の景色のかけらを浮かべる */
  private placeFragments(count: number) {
    const scene = this.host.gameScene;
    const spots = Phaser.Utils.Array.Shuffle([...this.host.voidSpots()]);
    const ts = DISPLAY.tileSize;
    const used: { x: number; y: number }[] = [];
    for (const s of spots) {
      if (used.length >= count) break;
      if (used.some((u) => Math.hypot(u.x - s.x, u.y - s.y) < ts * 6)) continue;
      used.push(s);
      const past = PAST_SCENES[used.length % PAST_SCENES.length];
      // 島の大きさはばらばら（行・列を少し削る）
      const rows = past.rows.slice(0, 2 + Math.floor(Math.random() * 3)).map((r) => r.slice(0, 3 + Math.floor(Math.random() * 3)));
      const layer = makeTilePatch(scene, rows, s.x - ts, s.y - ts).setDepth(-9500).setAlpha(0.7);
      scene.tweens.add({
        targets: layer,
        y: layer.y - 4,
        duration: 1600 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}

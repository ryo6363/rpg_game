import Phaser from 'phaser';
import type { CombatWorld } from '../systems/CombatWorld';

interface Pit {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 予兆の残り時間（0 以下で穴があく） */
  warn: number;
  warnTotal: number;
  /** 穴があいている残り時間（0 以下で道が戻る） */
  open: number;
  /** 落ちたら即死（ボス戦の道路崩壊） */
  lethal: boolean;
  power: number;
}

/**
 * 消える道路（最終章）。予兆（赤く点滅する床とひび）→ 穴があく → しばらくして道が戻る。
 * 穴の上に乗ると落ちる：lethal なら即死、そうでなければダメージを受けて直前の安全な場所へ戻される
 */
export class PitManager {
  private list: Pit[] = [];
  private g: Phaser.GameObjects.Graphics;
  private time = 0;
  /** 落ちた直後は続けて落ちない */
  private fallCooldown = 0;

  constructor(
    scene: Phaser.Scene,
    private world: CombatWorld,
  ) {
    // 床の上・敵や予兆より下
    this.g = scene.add.graphics().setDepth(-5005);
  }

  spawn(x: number, y: number, w: number, h: number, warn: number, open: number, lethal: boolean, power = 0) {
    this.list.push({ x, y, w, h, warn, warnTotal: warn, open, lethal, power });
  }

  /** その位置に穴があいているか */
  isOpen(x: number, y: number): boolean {
    return this.list.some((p) => p.warn <= 0 && p.open > 0 && Math.abs(x - p.x) <= p.w / 2 && Math.abs(y - p.y) <= p.h / 2);
  }

  /** その位置が、これから消える（予兆中）か穴か */
  isDanger(x: number, y: number): boolean {
    return this.list.some((p) => Math.abs(x - p.x) <= p.w / 2 + 4 && Math.abs(y - p.y) <= p.h / 2 + 4);
  }

  update(dt: number) {
    this.time += dt;
    this.fallCooldown -= dt;
    for (const p of this.list) {
      if (p.warn > 0) p.warn -= dt;
      else p.open -= dt;
    }
    this.list = this.list.filter((p) => p.warn > 0 || p.open > 0);

    // 落下判定（足元の中心が穴の中）
    const pl = this.world.player;
    if (!pl.dead && this.fallCooldown <= 0) {
      const pit = this.list.find((p) => p.warn <= 0 && p.open > 0 && Math.abs(pl.x - p.x) <= p.w / 2 - 2 && Math.abs(pl.y - p.y) <= p.h / 2 - 2);
      if (pit) {
        this.fallCooldown = 1;
        this.world.fallIntoPit(pit.lethal, pit.power);
      }
    }
    this.draw();
  }

  private draw() {
    const g = this.g;
    g.clear();
    for (const p of this.list) {
      const x0 = p.x - p.w / 2;
      const y0 = p.y - p.h / 2;
      if (p.warn > 0) {
        // 予兆：残り時間が少ないほど速く点滅、ひびが広がる
        const t = 1 - p.warn / p.warnTotal;
        const blink = Math.sin(this.time * (8 + t * 20)) > 0 ? 1 : 0.5;
        g.fillStyle(0xb13e53, (0.25 + t * 0.3) * blink).fillRect(x0, y0, p.w, p.h);
        g.lineStyle(1, 0xef7d57, 0.9).strokeRect(x0 + 0.5, y0 + 0.5, p.w - 1, p.h - 1);
        g.lineStyle(1, 0x1a1c2c, 0.8);
        const n = Math.ceil(t * 5);
        for (let i = 0; i < n; i++) {
          const a = i * 2.1 + p.x * 0.1;
          g.lineBetween(p.x, p.y, p.x + Math.cos(a) * p.w * 0.45, p.y + Math.sin(a) * p.h * 0.45);
        }
        // 「！」
        g.fillStyle(0xffd23f, blink).fillRect(p.x - 1, p.y - 5, 2, 6).fillRect(p.x - 1, p.y + 3, 2, 2);
      } else {
        // 穴：底の見えない闇と、ふちの光
        g.fillStyle(0x000000, 1).fillRect(x0, y0, p.w, p.h);
        g.lineStyle(1, 0x73eff7, 0.5 + Math.sin(this.time * 6) * 0.3).strokeRect(x0 + 0.5, y0 + 0.5, p.w - 1, p.h - 1);
        // 戻る直前はふちが白く光る
        if (p.open < 1) g.fillStyle(0xf4f4f4, (1 - p.open) * 0.5).fillRect(x0, y0, p.w, p.h);
      }
    }
  }

  clear() {
    this.list = [];
    this.g.clear();
  }
}

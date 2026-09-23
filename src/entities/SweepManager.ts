import Phaser from 'phaser';
import type { CombatWorld, SweepSpec } from '../systems/CombatWorld';

interface Sweep {
  spec: SweepSpec;
  pos: number;
  dir: number;
  hit: boolean;
  lastWater: number;
  g: Phaser.GameObjects.Graphics;
}

/**
 * 津波・尻尾の横薙ぎ。エリアを横切る帯が高速で進み、
 * 触れたプレイヤーにダメージと、進む向きへのノックバック。通ったあとに水を残すこともある
 */
export class SweepManager {
  private list: Sweep[] = [];
  private time = 0;

  constructor(
    private scene: Phaser.Scene,
    private world: CombatWorld,
  ) {}

  start(spec: SweepSpec) {
    const g = this.scene.add.graphics().setDepth(60000);
    this.list.push({ spec, pos: spec.from, dir: Math.sign(spec.to - spec.from) || 1, hit: false, lastWater: spec.from, g });
  }

  update(dt: number) {
    this.time += dt;
    const p = this.world.player;
    for (const s of this.list) {
      const sp = s.spec;
      s.pos += s.dir * sp.speed * dt;
      // 当たり判定：帯の厚みの中にいて、帯が広がる範囲の中にいる
      const along = sp.axis === 'y' ? p.y : p.x;
      const across = sp.axis === 'y' ? p.x : p.y;
      if (!s.hit && !p.dead && Math.abs(along - s.pos) <= sp.band / 2 + p.radius && across >= sp.spanMin && across <= sp.spanMax) {
        s.hit = true;
        this.world.damagePlayer(sp.power, sp.axis === 'x' ? s.pos : across, sp.axis === 'y' ? s.pos : across);
        const k = sp.knockback * s.dir;
        this.world.knockPlayer(sp.axis === 'x' ? k : 0, sp.axis === 'y' ? k : 0, 0.28);
      }
      // 通ったあとに水を残す
      if (sp.leaveWater && Math.abs(s.pos - s.lastWater) >= 26) {
        s.lastWater = s.pos;
        for (let c = sp.spanMin + 14; c <= sp.spanMax - 8; c += 30) {
          const x = sp.axis === 'y' ? c : s.pos - s.dir * sp.band * 0.5;
          const y = sp.axis === 'y' ? s.pos - s.dir * sp.band * 0.5 : c;
          if (!this.world.isWall(x, y)) this.world.spawnWater(x, y, 18, 6);
        }
      }
      this.draw(s);
    }
    // 端まで進んだら終わり
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if ((s.spec.to - s.pos) * s.dir < -s.spec.band) {
        s.g.destroy();
        this.list.splice(i, 1);
      }
    }
  }

  private draw(s: Sweep) {
    const sp = s.spec;
    const g = s.g;
    g.clear();
    const half = sp.band / 2;
    const rect = (a0: number, a1: number, color: number, alpha: number) => {
      const lo = Math.min(a0, a1);
      const size = Math.abs(a1 - a0);
      g.fillStyle(color, alpha);
      if (sp.axis === 'y') g.fillRect(sp.spanMin, lo, sp.spanMax - sp.spanMin, size);
      else g.fillRect(lo, sp.spanMin, size, sp.spanMax - sp.spanMin);
    };
    // 本体（深い青）→ 明るい層 → 先頭の白い泡
    rect(s.pos - half * s.dir, s.pos + half * s.dir, 0x29366f, 0.75);
    rect(s.pos - half * 0.2 * s.dir, s.pos + half * s.dir, 0x3b5dc9, 0.8);
    rect(s.pos + half * 0.6 * s.dir, s.pos + half * s.dir, 0x73eff7, 0.9);
    // 先頭のギザギザした泡
    g.fillStyle(0xf4f4f4, 0.9);
    const front = s.pos + half * s.dir;
    for (let c = sp.spanMin; c < sp.spanMax; c += 6) {
      const bump = 2 + Math.abs(Math.sin(c * 0.3 + this.time * 20)) * 3;
      if (sp.axis === 'y') g.fillRect(c, s.dir > 0 ? front : front - bump, 5, bump);
      else g.fillRect(s.dir > 0 ? front : front - bump, c, bump, 5);
    }
  }

  clear() {
    this.list.forEach((s) => s.g.destroy());
    this.list = [];
  }
}


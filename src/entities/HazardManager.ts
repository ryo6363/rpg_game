import Phaser from 'phaser';
import type { CombatWorld, HazardSpec } from '../systems/CombatWorld';

interface Hazard {
  spec: HazardSpec;
  remaining: number;
  flameTimer: number;
}

/**
 * 床に残る危険地帯（騎士の轍の炎など）。
 * 触れている間、tick 秒ごとに継続ダメージ（無敵時間なし）
 */
export class HazardManager {
  private list: Hazard[] = [];
  private dotTimer = 0;
  private g: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private world: CombatWorld,
  ) {
    this.g = scene.add.graphics().setDepth(-4995);
  }

  spawn(spec: HazardSpec) {
    this.list.push({ spec, remaining: spec.duration, flameTimer: Math.random() * 0.1 });
  }

  update(dt: number) {
    const g = this.g;
    g.clear();
    let touching: Hazard | null = null;
    const p = this.world.player;
    for (const h of this.list) {
      h.remaining -= dt;
      const fade = Math.min(1, h.remaining / 0.5);
      // 焦げた地面
      g.fillStyle(0x5d275d, 0.35 * fade).fillCircle(h.spec.x, h.spec.y, h.spec.radius);
      g.fillStyle(0xef7d57, 0.25 * fade).fillCircle(h.spec.x, h.spec.y, h.spec.radius * 0.6);
      // ゆらめく炎
      h.flameTimer -= dt;
      if (h.flameTimer <= 0 && fade > 0.3) {
        h.flameTimer = 0.18 + Math.random() * 0.12;
        this.spawnFlame(h.spec);
      }
      if (!p.dead && Math.hypot(p.x - h.spec.x, p.y - h.spec.y) <= h.spec.radius + p.radius * 0.5) touching = h;
    }
    this.list = this.list.filter((h) => h.remaining > 0);

    this.dotTimer -= dt;
    if (touching && this.dotTimer <= 0) {
      this.dotTimer = touching.spec.tick;
      this.world.damagePlayer(touching.spec.power, touching.spec.x, touching.spec.y, true);
    }
  }

  private spawnFlame(spec: HazardSpec) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * spec.radius * 0.8;
    const x = spec.x + Math.cos(a) * d;
    const y = spec.y + Math.sin(a) * d;
    const f = this.scene.add
      .sprite(Math.round(x), Math.round(y), 'fx_flame_red', 0)
      .setOrigin(0.5, 1)
      .setScale(0.8 + Math.random() * 0.5)
      .setDepth(y + 2)
      .play('fx_flame_red_burn');
    this.scene.tweens.add({ targets: f, y: y - 6, alpha: 0, duration: 420, onComplete: () => f.destroy() });
  }

  clear() {
    this.list = [];
    this.g.clear();
  }
}

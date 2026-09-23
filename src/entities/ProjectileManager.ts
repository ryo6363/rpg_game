import Phaser from 'phaser';
import type { CombatWorld, ProjectileSpec } from '../systems/CombatWorld';
import type { Enemy } from './Enemy';

interface Projectile {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  remaining: number;
  spec: ProjectileSpec;
  pierceLeft: number;
  hit: Set<Enemy>;
  active: boolean;
}

/** 弾の管理。画像は使い回して生成コストを抑える */
export class ProjectileManager {
  private list: Projectile[] = [];

  constructor(
    private scene: Phaser.Scene,
    private world: CombatWorld,
  ) {}

  spawn(spec: ProjectileSpec) {
    let p = this.list.find((q) => !q.active);
    if (!p) {
      p = {
        img: this.scene.add.image(0, 0, spec.sprite, 0),
        vx: 0,
        vy: 0,
        remaining: 0,
        spec,
        pierceLeft: 0,
        hit: new Set(),
        active: false,
      };
      this.list.push(p);
    }
    p.spec = spec;
    p.vx = Math.cos(spec.angle) * spec.speed;
    p.vy = Math.sin(spec.angle) * spec.speed;
    p.remaining = spec.distance;
    p.pierceLeft = spec.pierce ?? 0;
    p.hit.clear();
    p.active = true;
    p.img
      .setTexture(spec.sprite, 0)
      .setPosition(spec.x, spec.y)
      .setRotation(spec.angle)
      .setVisible(true)
      .setActive(true)
      .setDepth(spec.y + 10);
  }

  update(dt: number) {
    for (const p of this.list) {
      if (!p.active) continue;
      if (p.spec.curve) {
        // 渦を巻くように曲がる
        const a = p.spec.curve * dt;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        [p.vx, p.vy] = [p.vx * c - p.vy * sn, p.vx * sn + p.vy * c];
        p.img.setRotation(Math.atan2(p.vy, p.vx));
      }
      const step = Math.hypot(p.vx, p.vy) * dt;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.img.setDepth(p.img.y + 10);
      p.remaining -= step;

      if (p.remaining <= 0) {
        this.finish(p, true);
        continue;
      }
      if (this.world.isWall(p.img.x, p.img.y)) {
        this.finish(p, true);
        continue;
      }
      if (p.spec.hostile) this.checkPlayer(p);
      else this.checkEnemies(p);
    }
  }

  private checkEnemies(p: Projectile) {
    const r = p.spec.hitRadius ?? 3;
    for (const e of this.world.getLiveEnemies()) {
      if (p.hit.has(e)) continue;
      if (Math.hypot(e.x - p.img.x, e.y - p.img.y) > r + e.radius) continue;
      p.hit.add(e);
      if (!p.spec.explodeRadius) this.world.damageEnemy(e, p.spec.power, p.img.x - p.vx * 0.05, p.img.y - p.vy * 0.05);
      if (p.pierceLeft > 0) {
        p.pierceLeft--;
        continue;
      }
      this.finish(p, true);
      return;
    }
  }

  private checkPlayer(p: Projectile) {
    const pl = this.world.player;
    if (pl.dead) return;
    if (Math.hypot(pl.x - p.img.x, pl.y - p.img.y) <= (p.spec.hitRadius ?? 3) + pl.radius) {
      this.world.damagePlayer(p.spec.power, p.img.x, p.img.y);
      this.finish(p, false);
    }
  }

  /** 弾を消す。explode なら着弾爆発 */
  private finish(p: Projectile, explode: boolean) {
    p.active = false;
    p.img.setVisible(false).setActive(false);
    const er = p.spec.explodeRadius;
    if (explode && er && !p.spec.hostile) {
      this.world.damageArea(p.img.x, p.img.y, er, p.spec.power);
      this.world.showBlast(p.img.x, p.img.y, er, p.spec.color ?? 0xffffff);
    }
  }

  clear() {
    for (const p of this.list) {
      p.active = false;
      p.img.setVisible(false);
    }
  }
}

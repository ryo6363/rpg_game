import Phaser from 'phaser';
import { TELEGRAPH } from '../config/balance';
import type { AoeShape } from '../core/types';
import type { AoeSpec, CombatWorld } from '../systems/CombatWorld';

interface Aoe {
  spec: AoeSpec;
  g: Phaser.GameObjects.Graphics;
  elapsed: number;
  /** 判定後の光っている時間 */
  flash: number;
  done: boolean;
}

/**
 * 敵の攻撃の予兆範囲（FF14 の AoE 表示）。
 * 範囲を地面に表示し、内側が塗りつぶされきった瞬間に範囲内のプレイヤーへダメージ。
 */
export class AoeManager {
  private list: Aoe[] = [];

  constructor(
    private scene: Phaser.Scene,
    private world: CombatWorld,
  ) {}

  spawn(spec: AoeSpec) {
    // 地面の上・キャラより下に描く
    const g = this.scene.add.graphics().setDepth(-5000);
    this.list.push({ spec, g, elapsed: 0, flash: 0, done: false });
  }

  update(dt: number) {
    for (const a of this.list) {
      if (a.done) {
        a.flash -= dt;
        this.draw(a, 1, Math.max(0, a.flash / TELEGRAPH.flashTime));
        continue;
      }
      // 使い手が倒れたら詠唱中止
      if (a.spec.owner && !a.spec.owner.alive) {
        a.flash = -1;
        a.done = true;
        continue;
      }
      a.elapsed += dt;
      const p = Math.min(1, a.elapsed / a.spec.duration);
      this.draw(a, p, 0);
      if (p >= 1) {
        a.done = true;
        a.flash = TELEGRAPH.flashTime;
        if (this.contains(a.spec, this.world.player.x, this.world.player.y, this.world.player.radius)) {
          this.world.damagePlayer(a.spec.power, a.spec.x, a.spec.y);
        }
      }
    }
    // 光り終わったものを片付ける
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (a.done && a.flash <= 0) {
        a.g.destroy();
        this.list.splice(i, 1);
      }
    }
  }

  /** 点（半径 r の円）が範囲に入っているか */
  contains(spec: AoeSpec, px: number, py: number, r: number): boolean {
    const s = spec.shape;
    const dx = px - spec.x;
    const dy = py - spec.y;
    const cos = Math.cos(spec.angle);
    const sin = Math.sin(spec.angle);
    // 向きに沿った座標（along: 前方向、side: 横方向）
    const along = dx * cos + dy * sin;
    const side = -dx * sin + dy * cos;
    switch (s.type) {
      case 'circle': {
        const off = s.offset ?? 0;
        return Math.hypot(along - off, side) <= s.radius + r;
      }
      case 'cone': {
        const dist = Math.hypot(dx, dy);
        if (dist > s.radius + r) return false;
        if (dist <= r) return true;
        const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - spec.angle));
        // 体の大きさぶん角度に余裕を持たせる
        return diff <= Phaser.Math.DegToRad(s.angle / 2) + Math.asin(Math.min(1, r / dist));
      }
      case 'line':
        return along >= -r && along <= s.length + r && Math.abs(side) <= s.width / 2 + r;
    }
  }

  /** progress: 0〜1 の進み具合 / flash: 判定後の光の強さ */
  private draw(a: Aoe, progress: number, flash: number) {
    const { g, spec } = a;
    g.clear();
    if (a.done && flash <= 0) return;
    const T = TELEGRAPH;
    this.fillShape(g, spec, spec.shape, 1, T.fillColor, T.baseAlpha + flash * T.flashAlpha);
    if (!a.done) this.fillShape(g, spec, spec.shape, progress, T.fillColor, T.progressAlpha);
    g.lineStyle(1, T.edgeColor, T.edgeAlpha * (a.done ? flash : 1));
    this.strokeShape(g, spec, spec.shape);
  }

  /** scale: 塗る割合（円・扇は半径、帯は長さ） */
  private fillShape(g: Phaser.GameObjects.Graphics, spec: AoeSpec, s: AoeShape, scale: number, color: number, alpha: number) {
    if (scale <= 0) return;
    g.fillStyle(color, alpha);
    switch (s.type) {
      case 'circle': {
        const c = this.circleCenter(spec, s.offset ?? 0);
        g.fillCircle(c.x, c.y, s.radius * scale);
        break;
      }
      case 'cone': {
        const h = Phaser.Math.DegToRad(s.angle / 2);
        g.slice(spec.x, spec.y, s.radius * scale, spec.angle - h, spec.angle + h, false).fillPath();
        break;
      }
      case 'line':
        g.fillPoints(this.lineCorners(spec, s.length * scale, s.width), true);
        break;
    }
  }

  private strokeShape(g: Phaser.GameObjects.Graphics, spec: AoeSpec, s: AoeShape) {
    switch (s.type) {
      case 'circle': {
        const c = this.circleCenter(spec, s.offset ?? 0);
        g.strokeCircle(c.x, c.y, s.radius);
        break;
      }
      case 'cone': {
        const h = Phaser.Math.DegToRad(s.angle / 2);
        g.beginPath();
        g.slice(spec.x, spec.y, s.radius, spec.angle - h, spec.angle + h, false);
        g.closePath();
        g.strokePath();
        break;
      }
      case 'line':
        g.strokePoints(this.lineCorners(spec, s.length, s.width), true, true);
        break;
    }
  }

  private circleCenter(spec: AoeSpec, offset: number) {
    return { x: spec.x + Math.cos(spec.angle) * offset, y: spec.y + Math.sin(spec.angle) * offset };
  }

  private lineCorners(spec: AoeSpec, length: number, width: number): Phaser.Types.Math.Vector2Like[] {
    const cos = Math.cos(spec.angle);
    const sin = Math.sin(spec.angle);
    const hw = width / 2;
    const px = -sin * hw;
    const py = cos * hw;
    const ex = spec.x + cos * length;
    const ey = spec.y + sin * length;
    return [
      { x: spec.x + px, y: spec.y + py },
      { x: ex + px, y: ey + py },
      { x: ex - px, y: ey - py },
      { x: spec.x - px, y: spec.y - py },
    ];
  }

  clear() {
    this.list.forEach((a) => a.g.destroy());
    this.list = [];
  }
}

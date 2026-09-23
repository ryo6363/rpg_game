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
 * spec.safe の範囲は「安全地帯」の目印として水色で表示するだけ（ダメージなし）。
 */
export class AoeManager {
  private list: Aoe[] = [];

  constructor(
    private scene: Phaser.Scene,
    private world: CombatWorld,
  ) {}

  spawn(spec: AoeSpec) {
    // 地面の上・キャラより下に描く（安全地帯の目印は予兆より上）
    const g = this.scene.add.graphics().setDepth(spec.safe ? -4990 : -5000);
    this.list.push({ spec, g, elapsed: -(spec.delay ?? 0), flash: 0, done: false });
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
      // 出現待ち
      if (a.elapsed < 0) continue;
      const pl = this.world.player;
      // 潜航：しばらくプレイヤーを追いかけてから止まる
      if (a.spec.follow && a.elapsed < a.spec.follow && !pl.dead) {
        const k = Math.min(1, dt * 5);
        a.spec.x += (pl.x - a.spec.x) * k;
        a.spec.y += (pl.y - a.spec.y) * k;
      }
      // 渦：範囲内のプレイヤーを中心へ引き寄せる
      if (a.spec.pull && !pl.dead && this.contains(a.spec, pl.x, pl.y, 0)) {
        const ang = Math.atan2(a.spec.y - pl.y, a.spec.x - pl.x);
        this.world.pushPlayer(Math.cos(ang) * a.spec.pull, Math.sin(ang) * a.spec.pull);
      }
      const p = Math.min(1, a.elapsed / a.spec.duration);
      this.draw(a, p, 0);
      if (p >= 1) {
        a.done = true;
        a.flash = a.spec.safe || a.spec.noDamage ? 0 : TELEGRAPH.flashTime;
        a.spec.onResolve?.(a.spec);
        if (a.spec.safe || a.spec.noDamage) continue;
        if (a.spec.effect) this.world.showAoeEffect(a.spec);
        if (a.spec.leaveWater) this.world.spawnWater(a.spec.x, a.spec.y, a.spec.leaveWater.radius, a.spec.leaveWater.duration);
        if (this.contains(a.spec, pl.x, pl.y, pl.radius)) this.world.damagePlayer(a.spec.power, a.spec.x, a.spec.y);
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

  /** 点（半径 r の円）が範囲に入っているか。安全地帯（holes）の中なら false */
  contains(spec: AoeSpec, px: number, py: number, r: number): boolean {
    for (const h of spec.holes ?? []) {
      if (Math.hypot(px - h.x, py - h.y) <= h.r) return false;
    }
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
      case 'ring': {
        // 内側の安全地帯は、体が半分以上入っていれば安全
        const dist = Math.hypot(dx, dy);
        return dist <= s.outer + r && dist >= s.inner - r * 0.5;
      }
      case 'cross': {
        const hw = s.width / 2 + r;
        const len = s.length + r;
        return (Math.abs(along) <= len && Math.abs(side) <= hw) || (Math.abs(side) <= len && Math.abs(along) <= hw);
      }
      case 'rect':
        return Math.abs(along) <= s.length / 2 + r && Math.abs(side) <= s.width / 2 + r;
    }
  }

  /** 範囲内のランダムな点（炎などの演出用） */
  static randomPoint(spec: AoeSpec): { x: number; y: number } {
    const s = spec.shape;
    const cos = Math.cos(spec.angle);
    const sin = Math.sin(spec.angle);
    let along = 0;
    let side = 0;
    switch (s.type) {
      case 'circle': {
        const r = Math.sqrt(Math.random()) * s.radius;
        const a = Math.random() * Math.PI * 2;
        along = (s.offset ?? 0) + Math.cos(a) * r;
        side = Math.sin(a) * r;
        break;
      }
      case 'cone': {
        const r = Math.sqrt(Math.random()) * s.radius;
        const a = Phaser.Math.DegToRad((Math.random() - 0.5) * s.angle);
        along = Math.cos(a) * r;
        side = Math.sin(a) * r;
        break;
      }
      case 'line':
        along = Math.random() * s.length;
        side = (Math.random() - 0.5) * s.width;
        break;
      case 'ring': {
        const r = s.inner + Math.random() * (s.outer - s.inner);
        const a = Math.random() * Math.PI * 2;
        along = Math.cos(a) * r;
        side = Math.sin(a) * r;
        break;
      }
      case 'cross': {
        const t = (Math.random() * 2 - 1) * s.length;
        const w = (Math.random() - 0.5) * s.width;
        if (Math.random() < 0.5) [along, side] = [t, w];
        else [along, side] = [w, t];
        break;
      }
      case 'rect':
        along = (Math.random() - 0.5) * s.length;
        side = (Math.random() - 0.5) * s.width;
        break;
    }
    return { x: spec.x + along * cos - side * sin, y: spec.y + along * sin + side * cos };
  }

  /** progress: 0〜1 の進み具合 / flash: 判定後の光の強さ */
  private draw(a: Aoe, progress: number, flash: number) {
    const { g, spec } = a;
    g.clear();
    if (a.done && flash <= 0) return;
    const T = TELEGRAPH;
    if (spec.safe) {
      // 安全地帯の目印（水色）。周りの予兆が重なっても見えるよう、濃いめ・太めに描く
      const pulse = 0.75 + Math.sin(a.elapsed * 10) * 0.25;
      this.fillShape(g, spec, spec.shape, 1, 0x1a1c2c, 0.55);
      this.fillShape(g, spec, spec.shape, 1, 0x73eff7, 0.5 * pulse);
      g.lineStyle(2, 0x73eff7, 1);
      this.strokeShape(g, spec, spec.shape, 1);
      g.lineStyle(1, 0xffffff, pulse);
      this.strokeShape(g, spec, spec.shape, 0.7);
      return;
    }
    // grow: 範囲そのものが外へ広がっていく（必殺技）
    const outline = spec.grow ? Math.min(1, 0.15 + progress * 0.85) : 1;
    // 弾の軌道などの「表示だけ」の予兆は、ダメージ範囲と区別できるよう薄い青で描く
    const fillColor = spec.noDamage && !spec.onResolve ? 0x41a6f6 : T.fillColor;
    this.fillShape(g, spec, spec.shape, outline, fillColor, T.baseAlpha + flash * T.flashAlpha);
    if (!a.done) this.fillShape(g, spec, spec.shape, progress * outline, fillColor, T.progressAlpha);
    g.lineStyle(1, T.edgeColor, T.edgeAlpha * (a.done ? flash : 1));
    this.strokeShape(g, spec, spec.shape, outline);
  }

  /** scale: 塗る割合（円・扇は半径、帯は長さ、ドーナツは内から外へ、十字は中心から外へ） */
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
        g.fillPoints(this.lineCorners(spec.x, spec.y, spec.angle, 0, s.length * scale, s.width), true);
        break;
      case 'ring': {
        // 外周を一周してから内周を逆回りにたどる1つの多角形で、穴のあいた円を塗る（内側から外へ伸びる）
        const outer = s.inner + (s.outer - s.inner) * scale;
        const n = 48;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          pts.push({ x: spec.x + Math.cos(a) * outer, y: spec.y + Math.sin(a) * outer });
        }
        for (let i = n; i >= 0; i--) {
          const a = (i / n) * Math.PI * 2;
          pts.push({ x: spec.x + Math.cos(a) * s.inner, y: spec.y + Math.sin(a) * s.inner });
        }
        g.fillPoints(pts, true);
        break;
      }
      case 'rect':
        // 手前の辺（向きの反対側）から奥へ塗っていく
        g.fillPoints(this.lineCorners(spec.x, spec.y, spec.angle, -s.length / 2, -s.length / 2 + s.length * scale, s.width), true);
        break;
      case 'cross': {
        const L = s.length * scale;
        g.fillPoints(this.lineCorners(spec.x, spec.y, spec.angle, -L, L, s.width), true);
        g.fillPoints(this.lineCorners(spec.x, spec.y, spec.angle + Math.PI / 2, -L, L, s.width), true);
        break;
      }
    }
  }

  private strokeShape(g: Phaser.GameObjects.Graphics, spec: AoeSpec, s: AoeShape, scale: number) {
    switch (s.type) {
      case 'circle': {
        const c = this.circleCenter(spec, s.offset ?? 0);
        g.strokeCircle(c.x, c.y, s.radius * scale);
        break;
      }
      case 'cone': {
        const h = Phaser.Math.DegToRad(s.angle / 2);
        g.beginPath();
        g.slice(spec.x, spec.y, s.radius * scale, spec.angle - h, spec.angle + h, false);
        g.closePath();
        g.strokePath();
        break;
      }
      case 'line':
        g.strokePoints(this.lineCorners(spec.x, spec.y, spec.angle, 0, s.length * scale, s.width), true, true);
        break;
      case 'ring':
        g.strokeCircle(spec.x, spec.y, s.inner);
        g.strokeCircle(spec.x, spec.y, s.outer * scale);
        break;
      case 'rect':
        g.strokePoints(this.lineCorners(spec.x, spec.y, spec.angle, -s.length / 2, s.length / 2, s.width), true, true);
        break;
      case 'cross':
        g.strokePoints(this.lineCorners(spec.x, spec.y, spec.angle, -s.length, s.length, s.width), true, true);
        g.strokePoints(this.lineCorners(spec.x, spec.y, spec.angle + Math.PI / 2, -s.length, s.length, s.width), true, true);
        break;
    }
  }

  private circleCenter(spec: AoeSpec, offset: number) {
    return { x: spec.x + Math.cos(spec.angle) * offset, y: spec.y + Math.sin(spec.angle) * offset };
  }

  /** 向き angle の帯（from〜to の長さ、幅 width）の四隅 */
  private lineCorners(x: number, y: number, angle: number, from: number, to: number, width: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = width / 2;
    const px = -sin * hw;
    const py = cos * hw;
    const sx = x + cos * from;
    const sy = y + sin * from;
    const ex = x + cos * to;
    const ey = y + sin * to;
    return [
      { x: sx + px, y: sy + py },
      { x: ex + px, y: ey + py },
      { x: ex - px, y: ey - py },
      { x: sx - px, y: sy - py },
    ];
  }

  clear() {
    this.list.forEach((a) => a.g.destroy());
    this.list = [];
  }
}

import Phaser from 'phaser';
import { WATER } from '../config/balance';

interface Water {
  x: number;
  y: number;
  r: number;
  /** 残り時間（Infinity なら消えない） */
  remaining: number;
  /** 現れてからの時間（ふわっと広がる演出用） */
  age: number;
}

interface Tide {
  x: number;
  y: number;
  r: number;
  /** 満ち引きの位相（秒） */
  t: number;
}

/**
 * 水エリア（ダメージはなく、中にいると移動が遅くなる）。
 * - 攻撃で生まれる水たまり（時間で消える）
 * - 満ち引きで現れたり消えたりする潮だまり（マップの目印の位置）
 */
export class WaterManager {
  private list: Water[] = [];
  private tides: Tide[] = [];
  /** 描画用（画面には直接出さず、下の rt に描き込む） */
  private g: Phaser.GameObjects.Graphics;
  /** 重なった水たまりが1つの水面に見えるよう、いったん1枚に描いてから半透明で重ねる */
  private rt: Phaser.GameObjects.RenderTexture;
  private time = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.g = new Phaser.GameObjects.Graphics(scene);
    this.rt = scene.add.renderTexture(0, 0, width, height).setOrigin(0).setDepth(-4998).setAlpha(0.55);
  }

  spawn(x: number, y: number, r: number, duration: number) {
    this.list.push({ x, y, r, remaining: duration, age: 0 });
  }

  /** 潮だまりを置く（WATER.tide の周期で満ち引きする） */
  addTide(x: number, y: number) {
    this.tides.push({ x, y, r: WATER.tide.radius, t: Math.random() * (WATER.tide.wet + WATER.tide.dry) });
  }

  /** その位置が水の中か */
  contains(x: number, y: number): boolean {
    for (const w of this.list) if (Math.hypot(x - w.x, y - w.y) <= w.r * this.growth(w)) return true;
    for (const t of this.tides) {
      const r = t.r * this.tideLevel(t);
      if (r > 2 && Math.hypot(x - t.x, y - t.y) <= r) return true;
    }
    return false;
  }

  update(dt: number) {
    this.time += dt;
    for (const w of this.list) {
      w.remaining -= dt;
      w.age += dt;
    }
    this.list = this.list.filter((w) => w.remaining > 0);
    for (const t of this.tides) t.t += dt;
    this.draw();
  }

  private growth(w: Water) {
    return Math.min(1, w.age / 0.3);
  }

  /** 潮だまりの広がり 0〜1（満ちる → しばらく満ちたまま → 引く → 乾いたまま） */
  private tideLevel(t: Tide) {
    const { wet, dry } = WATER.tide;
    const phase = t.t % (wet + dry);
    if (phase > wet) return 0;
    const edge = 1;
    return Math.min(1, phase / edge, (wet - phase) / edge);
  }

  private draw() {
    const g = this.g;
    g.clear();
    // 今見えている水たまり（消えかけは縮む）
    const pools: { x: number; y: number; r: number }[] = [];
    for (const w of this.list) pools.push({ x: w.x, y: w.y, r: w.r * this.growth(w) * Math.min(1, w.remaining / 0.8) });
    for (const t of this.tides) pools.push({ x: t.x, y: t.y, r: t.r * this.tideLevel(t) });
    const visible = pools.filter((p) => p.r >= 1);
    // 1. 水ぎわ（明るい色）→ 2. 水面 で塗ると、重なった水たまりは1つの形になる
    g.fillStyle(0x73eff7, 1);
    for (const p of visible) g.fillCircle(p.x, p.y, p.r);
    g.fillStyle(0x3b5dc9, 1);
    for (const p of visible) g.fillCircle(p.x, p.y, Math.max(0, p.r - 1.5));
    // 3. 波紋（ほかの水たまりと重なっていないものだけ。広い水面は模様がうるさくなるので出さない）
    for (const p of visible) {
      const alone = visible.every((o) => o === p || Math.hypot(o.x - p.x, o.y - p.y) > o.r + p.r);
      if (!alone) continue;
      const ripple = ((this.time * 0.6 + p.x * 0.01) % 1) * p.r;
      g.lineStyle(1, 0x73eff7, 1 - ripple / p.r).strokeCircle(p.x, p.y, ripple);
    }
    this.rt.clear();
    if (visible.length) this.rt.draw(g);
    // ゆらめき
    this.rt.setAlpha(0.5 + Math.sin(this.time * 3) * 0.05);
  }

  clear() {
    this.list = [];
  }
}

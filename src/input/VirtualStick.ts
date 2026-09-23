import Phaser from 'phaser';
import { CONTROLS } from '../config/balance';

/**
 * フローティング式の仮想スティック。
 * 指定領域内のどこを触っても、その位置にスティックが出る。
 * 座標はすべて論理px。
 */
export class VirtualStick {
  x = 0;
  y = 0;
  private pointerId: number | null = null;
  private baseX: number;
  private baseY: number;
  private knobX: number;
  private knobY: number;
  private g: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private area: Phaser.Geom.Rectangle,
    private restX: number,
    private restY: number,
  ) {
    this.baseX = this.knobX = restX;
    this.baseY = this.knobY = restY;
    this.g = scene.add.graphics();
    this.draw();
  }

  get active() {
    return this.pointerId !== null;
  }

  /** 領域内ならこのポインタを掴む */
  tryGrab(id: number, px: number, py: number): boolean {
    if (this.pointerId !== null || !this.area.contains(px, py)) return false;
    this.pointerId = id;
    this.baseX = this.knobX = px;
    this.baseY = this.knobY = py;
    this.update(0, 0);
    return true;
  }

  move(id: number, px: number, py: number) {
    if (id !== this.pointerId) return;
    this.update(px - this.baseX, py - this.baseY);
  }

  release(id: number) {
    if (id !== this.pointerId) return;
    this.pointerId = null;
    this.baseX = this.knobX = this.restX;
    this.baseY = this.knobY = this.restY;
    this.x = this.y = 0;
    this.draw();
  }

  private update(dx: number, dy: number) {
    const R = CONTROLS.stickRadius;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, R);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.knobX = this.baseX + nx * clamped;
    this.knobY = this.baseY + ny * clamped;
    const mag = clamped / R;
    if (mag < CONTROLS.stickDeadZone) {
      this.x = this.y = 0;
    } else {
      // デッドゾーンを除いて 0〜1 に正規化
      const m = (mag - CONTROLS.stickDeadZone) / (1 - CONTROLS.stickDeadZone);
      this.x = nx * m;
      this.y = ny * m;
    }
    this.draw();
  }

  private draw() {
    const g = this.g;
    const R = CONTROLS.stickRadius;
    const a = this.active ? 1 : 0.5;
    g.clear();
    g.fillStyle(0x1a1c2c, 0.35 * a).fillCircle(this.baseX, this.baseY, R + 4);
    g.lineStyle(1, 0xf4f4f4, 0.5 * a).strokeCircle(this.baseX, this.baseY, R + 4);
    g.fillStyle(0xf4f4f4, 0.55 * a).fillCircle(this.knobX, this.knobY, 9);
    g.lineStyle(1, 0x1a1c2c, 0.6 * a).strokeCircle(this.knobX, this.knobY, 9);
  }
}

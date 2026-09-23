import Phaser from 'phaser';
import { createText } from '../ui/text';

export interface ActionButton {
  x: number;
  y: number;
  r: number;
  label: string;
  color: number;
  locked: boolean;
  /** 残りクールダウンの割合 0〜1 */
  cooldown: number;
  pressed: boolean;
  text: Phaser.GameObjects.Text;
}

/** 右下の攻撃ボタン・スキルボタン群。座標は論理px */
export class ActionButtons {
  readonly buttons: ActionButton[] = [];
  /** ボタンを押しているポインタ id → ボタン番号 */
  private held = new Map<number, number>();
  private g: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
  }

  add(x: number, y: number, r: number, label: string, color: number, locked = false): number {
    const text = createText(this.scene, x, y, label, r > 14 ? 8 : 6).setOrigin(0.5);
    this.buttons.push({ x, y, r, label, color, locked, cooldown: 0, pressed: false, text });
    return this.buttons.length - 1;
  }

  /** 当たったボタン番号（判定は見た目より少し大きめ） */
  hitTest(px: number, py: number): number {
    let best = -1;
    let bestD = Infinity;
    this.buttons.forEach((b, i) => {
      const d = Math.hypot(px - b.x, py - b.y);
      if (d <= b.r * 1.25 && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  press(id: number, index: number) {
    this.held.set(id, index);
    this.buttons[index].pressed = true;
  }

  release(id: number): number | undefined {
    const index = this.held.get(id);
    if (index === undefined) return undefined;
    this.held.delete(id);
    if (![...this.held.values()].includes(index)) this.buttons[index].pressed = false;
    return index;
  }

  setLabel(index: number, label: string) {
    const b = this.buttons[index];
    if (b.label === label) return;
    b.label = label;
    b.text.setText(label).setFontSize(b.r > 14 || label.length <= 2 ? (b.r > 14 ? 8 : 6) : 5);
  }

  isHeld(index: number) {
    return this.buttons[index]?.pressed ?? false;
  }

  draw() {
    const g = this.g;
    g.clear();
    for (const b of this.buttons) {
      const alpha = b.locked ? 0.25 : b.pressed ? 0.9 : 0.6;
      const r = b.pressed ? b.r - 1 : b.r;
      g.fillStyle(0x1a1c2c, 0.5).fillCircle(b.x, b.y, r + 1);
      g.fillStyle(b.color, alpha).fillCircle(b.x, b.y, r);
      g.lineStyle(1, 0xf4f4f4, b.locked ? 0.3 : 0.8).strokeCircle(b.x, b.y, r);
      if (b.cooldown > 0 && !b.locked) {
        // 残りクールダウンを扇形で暗く表示
        const start = -Math.PI / 2;
        g.fillStyle(0x1a1c2c, 0.65);
        g.slice(b.x, b.y, r, start, start + Math.PI * 2 * b.cooldown, false).fillPath();
      }
      b.text.setAlpha(b.locked ? 0.4 : 1);
    }
  }
}

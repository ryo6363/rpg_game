import Phaser from 'phaser';
import { viewport } from '../core/Viewport';
import { closeOverlay } from '../ui/overlay';
import { Sfx } from '../ui/sfx';
import { createText, wrapJa } from '../ui/text';

/**
 * ナビの画面に出る選択肢（最終章：「ループシステムを停止しますか？」）。
 * 「いいえ」は押しても指が止まり、選べるのは「はい」だけ
 */
export class ChoiceScene extends Phaser.Scene {
  private question = '';
  private onComplete?: () => void;
  private readyAt = 0;

  constructor() {
    super('Choice');
  }

  init(data: { question: string; onComplete?: () => void }) {
    this.question = data.question;
    this.onComplete = data.onComplete;
  }

  create() {
    const { width: W, height: H } = viewport;
    this.readyAt = this.time.now + 400;
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0);

    // ナビの画面
    const pw = W - 30;
    const ph = 96;
    const px = 15;
    const py = H / 2 - ph / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0b1a2a, 0.95).fillRect(px, py, pw, ph);
    g.lineStyle(1, 0x73eff7, 1).strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    g.fillStyle(0x73eff7, 0.15).fillRect(px, py, pw, 12);
    createText(this, px + 4, py + 2, 'NAVI', 6, '#73eff7');
    createText(this, W / 2, py + 30, wrapJa(this.question, pw - 16, 8), 8, '#f4f4f4', { align: 'center' }).setOrigin(0.5);

    const bw = 56;
    const by = py + ph - 26;
    const yes = this.button(W / 2 - bw - 6, by, bw, 16, 'はい', 0x257179);
    const no = this.button(W / 2 + 6, by, bw, 16, 'いいえ', 0x333c57);
    const note = createText(this, W / 2, py + ph + 10, '', 6, '#94b0c2').setOrigin(0.5);

    yes.on('pointerup', () => {
      if (this.time.now < this.readyAt) return;
      Sfx.chime();
      this.cameras.main.flash(300, 255, 255, 255);
      this.time.delayedCall(350, () => {
        const cb = this.onComplete;
        closeOverlay(this);
        cb?.();
      });
    });
    // 「いいえ」は選べない
    no.on('pointerup', () => {
      if (this.time.now < this.readyAt) return;
      this.cameras.main.shake(200, 0.01);
      note.setText('……指が、動かなかった。');
    });
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRect(x, y, w, h);
    g.lineStyle(1, 0xf4f4f4, 0.8).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    createText(this, x + w / 2, y + h / 2, label, 8, '#f4f4f4').setOrigin(0.5);
    return this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
  }
}

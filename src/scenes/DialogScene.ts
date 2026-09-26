import Phaser from 'phaser';
import { DIALOG } from '../config/balance';
import type { DialogLine } from '../core/types';
import { viewport } from '../core/Viewport';
import { closeOverlay } from '../ui/overlay';
import { createText, wrapJa } from '../ui/text';

export interface DialogData {
  lines: DialogLine[];
  /** 会話を閉じたあとに呼ばれる（フィールド／町は再開済み） */
  onComplete?: () => void;
  /**
   * ボス戦中：攻撃ボタンの連打で読み飛ばさないよう、画面のタップ・J・Space では送らない。
   * 攻撃ボタンから離れた「次へ」ボタン（と Enter キー）だけで送る
   */
  guarded?: boolean;
}

const FONT = 8;

/** 画面下の会話ウィンドウ。タップ（または J / Space / Enter）で送る */
export class DialogScene extends Phaser.Scene {
  private lines: DialogLine[] = [];
  private onComplete?: () => void;
  private index = 0;
  private shown = 0;
  private full = '';
  private body!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private nameBox!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Text;
  private textWidth = 0;
  /** 開いた直後のタップ（話しかけたときの指）を無視する */
  private readyAt = 0;
  private guarded = false;

  constructor() {
    super('Dialog');
  }

  init(data: DialogData) {
    this.lines = data.lines;
    this.onComplete = data.onComplete;
    this.index = 0;
    this.guarded = !!data.guarded;
  }

  create() {
    const { width: W, height: H, safe } = viewport;
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    // 背景を少し暗く（止まっているフィールドが透けて見える）
    this.add.rectangle(0, 0, W, H, 0x1a1c2c, 0.35).setOrigin(0);

    const boxH = 58;
    const x = safe.left + 6;
    const w = W - safe.left - safe.right - 12;
    const y = H - safe.bottom - boxH - 10;
    const g = this.add.graphics();
    g.fillStyle(0x1a1c2c, 0.94).fillRect(x, y, w, boxH);
    g.lineStyle(1, 0xf4f4f4, 0.9).strokeRect(x + 0.5, y + 0.5, w - 1, boxH - 1);
    g.lineStyle(1, 0x566c86, 1).strokeRect(x + 2.5, y + 2.5, w - 5, boxH - 5);

    this.nameBox = this.add.graphics();
    this.nameText = createText(this, x + 8, y - 10, '', 8, '#ffd23f');
    this.body = createText(this, x + 8, y + 7, '', FONT, '#f4f4f4', { lineSpacing: 3 });
    this.textWidth = w - 16;
    this.cursor = createText(this, x + w - 8, y + boxH - 5, '▼', 6, '#f4f4f4').setOrigin(1, 1);
    this.tweens.add({ targets: this.cursor, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });

    const kb = this.input.keyboard!;
    if (this.guarded) {
      // 「次へ」ボタン：会話ウィンドウの上・中央（右下の攻撃ボタンから離す）
      const bw = 64;
      const bh = 16;
      const bx = (W - bw) / 2;
      const by = y - bh - 16;
      const bg = this.add.graphics();
      bg.fillStyle(0x257179, 1).fillRect(bx, by, bw, bh);
      bg.lineStyle(1, 0xf4f4f4, 0.9).strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      createText(this, bx + bw / 2, by + bh / 2, '次へ ▶', 8, '#f4f4f4').setOrigin(0.5);
      const zone = this.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive();
      zone.on('pointerup', () => this.advance());
      kb.on('keydown-ENTER', () => this.advance());
    } else {
      this.input.on('pointerup', () => this.advance());
      ['keydown-J', 'keydown-SPACE', 'keydown-ENTER'].forEach((ev) => kb.on(ev, () => this.advance()));
    }

    this.readyAt = this.time.now + (this.guarded ? 500 : 250);
    this.showLine();
  }

  private showLine() {
    const line = this.lines[this.index];
    if (!line) {
      this.finish();
      return;
    }
    const narration = !line.s;
    this.nameText.setText(line.s ?? '');
    this.nameBox.clear();
    if (!narration) {
      const nx = this.nameText.x - 4;
      const ny = this.nameText.y - 2;
      this.nameBox.fillStyle(0x1a1c2c, 0.94).fillRect(nx, ny, this.nameText.width + 8, 12);
      this.nameBox.lineStyle(1, 0xf4f4f4, 0.9).strokeRect(nx + 0.5, ny + 0.5, this.nameText.width + 7, 11);
    }
    this.body.setColor(narration ? '#b8c7dd' : '#f4f4f4');
    this.full = wrapJa(line.t, this.textWidth, FONT);
    this.shown = 0;
    this.body.setText('');
    this.cursor.setVisible(false);
  }

  /** タップ：表示途中なら全文表示、表示済みなら次へ */
  private advance() {
    if (this.time.now < this.readyAt) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.body.setText(this.full);
      this.cursor.setVisible(true);
      return;
    }
    this.index++;
    this.showLine();
  }

  update(_time: number, deltaMs: number) {
    if (this.shown >= this.full.length) return;
    this.shown = Math.min(this.full.length, this.shown + (deltaMs / 1000) * DIALOG.charsPerSecond);
    this.body.setText(this.full.slice(0, Math.floor(this.shown)));
    if (this.shown >= this.full.length) this.cursor.setVisible(true);
  }

  private finish() {
    const cb = this.onComplete;
    closeOverlay(this);
    cb?.();
  }
}

import Phaser from 'phaser';
import { viewport } from '../core/Viewport';
import { closeOverlay } from '../ui/overlay';
import { createText } from '../ui/text';

/**
 * 章タイトルの暗転（世界が崩壊したあとの「最終章」など）。
 * 真っ黒な画面に章の名前が浮かび、消えたら onComplete
 */
export class TitleCardScene extends Phaser.Scene {
  private title = '';
  private subtitle = '';
  private onComplete?: () => void;

  constructor() {
    super('TitleCard');
  }

  init(data: { title: string; subtitle: string; onComplete?: () => void }) {
    this.title = data.title;
    this.subtitle = data.subtitle;
    this.onComplete = data.onComplete;
  }

  create() {
    const { width: W, height: H } = viewport;
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setAlpha(0);
    const title = createText(this, W / 2, H * 0.42, this.title, 8, '#94b0c2').setOrigin(0.5).setAlpha(0);
    const sub = createText(this, W / 2, H * 0.42 + 18, this.subtitle, 16, '#f4f4f4').setOrigin(0.5).setAlpha(0);
    const line = this.add.rectangle(W / 2, H * 0.42 + 34, 90, 1, 0xffd23f, 1).setScale(0, 1);

    this.tweens.add({ targets: bg, alpha: 1, duration: 1000 });
    this.tweens.add({ targets: title, alpha: 1, delay: 1400, duration: 800 });
    this.tweens.add({ targets: sub, alpha: 1, delay: 2000, duration: 1000 });
    this.tweens.add({ targets: line, scaleX: 1, delay: 2400, duration: 900, ease: 'Quad.easeOut' });
    this.time.delayedCall(5200, () => {
      this.tweens.add({
        targets: [title, sub, line],
        alpha: 0,
        duration: 700,
        onComplete: () => {
          const cb = this.onComplete;
          closeOverlay(this);
          cb?.();
        },
      });
    });
  }
}

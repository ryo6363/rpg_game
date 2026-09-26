import Phaser from 'phaser';
import type { Rarity } from '../core/types';
import { RARITY_META } from '../data/itemMeta';
import { rainbowNow } from '../ui/rarityStyle';

/** 地面に落ちているガソリン（回復アイテム）。レアリティの色で光る */
export class GasDrop {
  ready = false;
  x: number;
  y: number;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private rainbowTimer?: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    readonly rarity: Rarity,
    fromX: number,
    fromY: number,
  ) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 8;
    this.x = Math.round(fromX + Math.cos(ang) * dist);
    this.y = Math.round(fromY + Math.sin(ang) * dist);
    const meta = RARITY_META[rarity];
    const color = meta.rainbow ? 0xffffff : meta.tint;
    this.glow = scene.add.image(this.x, this.y + 4, 'fx_glow', 0).setTint(color).setAlpha(0).setDepth(this.y - 1);
    this.img = scene.add.image(fromX, fromY, 'gas_can', 0).setDepth(this.y);
    if (rarity !== 'normal') this.img.setTint(color);

    // 飛び出して着地
    const t = { p: 0 };
    scene.tweens.add({
      targets: t,
      p: 1,
      duration: 320,
      onUpdate: () => {
        const hop = Math.sin(t.p * Math.PI) * 12;
        this.img.setPosition(fromX + (this.x - fromX) * t.p, fromY + (this.y - fromY) * t.p - hop);
      },
      onComplete: () => {
        this.ready = true;
        this.glow.setAlpha(0.5);
        scene.tweens.add({ targets: this.img, y: this.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (meta.rainbow) {
          this.rainbowTimer = scene.time.addEvent({
            delay: 60,
            loop: true,
            callback: () => {
              const c = rainbowNow();
              this.img.setTint(c);
              this.glow.setTint(c);
            },
          });
        }
      },
    });
  }

  /** 拾われた：プレイヤーへ吸い込まれて消える */
  collect(toX: number, toY: number) {
    this.rainbowTimer?.remove();
    this.scene.tweens.killTweensOf(this.img);
    this.glow.destroy();
    this.scene.tweens.add({
      targets: this.img,
      x: toX,
      y: toY - 6,
      alpha: 0,
      scale: 0.5,
      duration: 180,
      onComplete: () => this.img.destroy(),
    });
  }

  destroy() {
    this.rainbowTimer?.remove();
    this.img.destroy();
    this.glow.destroy();
  }
}

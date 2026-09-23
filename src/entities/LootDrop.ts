import Phaser from 'phaser';
import type { ItemInstance } from '../core/types';
import { ITEM_BASES } from '../data/itemBases';
import { RARITY_META } from '../data/itemMeta';
import { rainbowColor } from '../ui/rarityStyle';

/** レアリティごとの光の柱の高さ（論理px） */
const BEAM_HEIGHT = { normal: 0, magic: 10, rare: 20, legendary: 34 } as const;

/** 地面に落ちている装備。レアリティ色の光の柱で目立たせる */
export class LootDrop {
  ready = false;
  x: number;
  y: number;
  private icon: Phaser.GameObjects.Image;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private rainbow?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    readonly item: ItemInstance,
    fromX: number,
    fromY: number,
  ) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 8;
    this.x = Math.round(fromX + Math.cos(ang) * dist);
    this.y = Math.round(fromY + Math.sin(ang) * dist);

    const base = ITEM_BASES[item.baseId];
    this.icon = scene.add.image(fromX, fromY, base.icon, 0).setDepth(this.y);

    // 飛び出して着地する放物線
    const t = { p: 0 };
    scene.tweens.add({
      targets: t,
      p: 1,
      duration: 350,
      ease: 'Linear',
      onUpdate: () => {
        const hop = Math.sin(t.p * Math.PI) * 14;
        this.icon.setPosition(fromX + (this.x - fromX) * t.p, fromY + (this.y - fromY) * t.p - hop);
      },
      onComplete: () => this.land(),
    });
  }

  private land() {
    const scene = this.scene;
    const meta = RARITY_META[this.item.rarity];
    const rainbow = meta.rainbow;
    const color = rainbow ? 0xffffff : meta.tint;
    const h = BEAM_HEIGHT[this.item.rarity];
    this.ready = true;
    // 虹色にする対象
    const tinted: Phaser.GameObjects.Image[] = [];

    // 足元の光
    const glow = scene.add
      .image(this.x, this.y + 5, 'fx_glow', 0)
      .setTint(color)
      .setAlpha(0.55)
      .setDepth(this.y - 1);
    this.parts.push(glow);
    tinted.push(glow);

    if (h > 0) {
      // 外側：レアリティ色の半透明 / 内側：同じ色の芯
      const outer = scene.add
        .image(this.x, this.y + 3, 'fx_pixel', 0)
        .setOrigin(0.5, 1)
        .setScale(3, 0)
        .setTint(color)
        .setAlpha(0.45)
        .setDepth(this.y + 1);
      const core = scene.add
        .image(this.x, this.y + 3, 'fx_pixel', 0)
        .setOrigin(0.5, 1)
        .setScale(1, 0)
        .setTint(color)
        .setAlpha(1)
        .setDepth(this.y + 1);
      this.parts.push(outer, core);
      tinted.push(outer, core);
      scene.tweens.add({ targets: [outer, core], scaleY: h, duration: 250, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: outer, alpha: 0.2, duration: 600, yoyo: true, repeat: -1, delay: 250 });
    }

    if (this.item.rarity === 'rare' || this.item.rarity === 'legendary') {
      // 広がる輪
      const ring = scene.add
        .image(this.x, this.y, 'fx_ring', 0)
        .setTint(color)
        .setDepth(this.y + 2);
      tinted.push(ring);
      scene.tweens.add({
        targets: ring,
        scale: this.item.rarity === 'legendary' ? 4 : 2.5,
        alpha: 0,
        duration: 600,
        repeat: this.item.rarity === 'legendary' ? 2 : 0,
        onComplete: () => ring.destroy(),
      });
    }

    if (rainbow) {
      // 色相を回して虹色に光らせる（柱は下から上へ色がずれる）
      this.rainbow = scene.tweens.addCounter({
        from: 0,
        to: 360,
        duration: 1200,
        repeat: -1,
        onUpdate: (tw) => {
          const hue = tw.getValue() ?? 0;
          tinted.forEach((o, i) => {
            if (!o.active) return;
            o.setTint(rainbowColor(hue + i * 40));
          });
        },
      });
    }

    // ふわふわ上下
    this.icon.setPosition(this.x, this.y).setDepth(this.y + 3);
    scene.tweens.add({ targets: this.icon, y: this.y - 2, duration: 500, yoyo: true, repeat: -1 });
  }

  /** 拾われる演出をして消える */
  collect(toX: number, toY: number) {
    this.ready = false;
    this.rainbow?.remove();
    this.scene.tweens.killTweensOf(this.parts);
    this.parts.forEach((p) => p.destroy());
    this.scene.tweens.killTweensOf(this.icon);
    this.scene.tweens.add({
      targets: this.icon,
      x: toX,
      y: toY - 6,
      scale: 0.5,
      alpha: 0,
      duration: 180,
      onComplete: () => this.icon.destroy(),
    });
  }

  destroy() {
    this.ready = false;
    this.rainbow?.remove();
    this.scene.tweens.killTweensOf(this.parts);
    this.parts.forEach((p) => p.destroy());
    this.scene.tweens.killTweensOf(this.icon);
    this.icon.destroy();
  }
}

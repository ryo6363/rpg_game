import Phaser from 'phaser';
import { createText } from '../ui/text';

/** ダメージ数字などの浮き上がる文字。Text の生成は重いので使い回す */
export class FloatingTextPool {
  private pool: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene, size = 20) {
    for (let i = 0; i < size; i++) {
      const t = createText(scene, 0, 0, '', 8, '#ffffff', { stroke: '#1a1c2c', strokeThickness: 2 })
        .setOrigin(0.5, 1)
        .setVisible(false)
        .setActive(false);
      this.pool.push(t);
    }
  }

  show(x: number, y: number, text: string, color: string, big = false) {
    const t = this.pool.find((p) => !p.active) ?? this.pool[0];
    this.scene.tweens.killTweensOf(t);
    t.setText(text)
      .setColor(color)
      .setFontSize(big ? 10 : 8)
      .setPosition(x + (Math.random() * 6 - 3), y)
      .setAlpha(1)
      .setScale(big ? 1.3 : 1)
      .setDepth(100000)
      .setActive(true)
      .setVisible(true);
    this.scene.tweens.add({
      targets: t,
      y: y - 14,
      scale: 1,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          y: y - 18,
          duration: 200,
          onComplete: () => t.setActive(false).setVisible(false),
        });
      },
    });
  }
}

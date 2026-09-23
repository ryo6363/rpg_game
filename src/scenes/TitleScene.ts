import Phaser from 'phaser';
import { EventBus, GameEvents } from '../core/EventBus';
import { viewport } from '../core/Viewport';
import { createText } from '../ui/text';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const layout = () => {
      this.children.removeAll(true);
      this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0).setBackgroundColor('#1a1c2c');
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      createText(this, cx, cy - 60, 'フィットクエスト', 16, '#ffcd75').setOrigin(0.5);
      createText(this, cx, cy - 40, '〜 第1章 はじまりの草原 〜', 8, '#94b0c2').setOrigin(0.5);
      this.add.sprite(cx, cy, 'car_warrior', 0).play('car_warrior_move');
      const tap = createText(this, cx, cy + 50, 'タップしてはじめる', 8).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
      createText(this, cx, viewport.height - viewport.safe.bottom - 10, `build ${__BUILD_TIME__}`, 6, '#566c86').setOrigin(0.5);
    };
    layout();
    EventBus.on(GameEvents.ViewportChanged, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off(GameEvents.ViewportChanged, layout));

    const start = () => this.scene.start('Field', { areaId: 'ch1_field1' });
    this.input.once('pointerup', start);
    this.input.keyboard?.once('keydown', start);
  }
}

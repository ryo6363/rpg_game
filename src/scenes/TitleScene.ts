import Phaser from 'phaser';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { viewport } from '../core/Viewport';
import { CHAPTERS } from '../data/chapters';
import { JOBS } from '../data/jobs';
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
      const ch = CHAPTERS[gameState.story.chapter];
      createText(this, cx, cy - 64, 'FIT QUEST', 16, '#ffcd75').setOrigin(0.5);
      createText(this, cx, cy - 46, 'フィットクエスト', 8, '#f4f4f4').setOrigin(0.5);
      createText(this, cx, cy - 30, `〜 第${ch.id}章 ${ch.title} 〜`, 8, '#94b0c2').setOrigin(0.5);
      if (gameState.story.loop > 1) {
        createText(this, cx, cy - 18, `${gameState.story.loop}周目`, 6, '#ffd23f').setOrigin(0.5);
      }
      const car = JOBS[gameState.currentJob].sprite;
      this.add.sprite(cx, cy + 4, car, 0).play(`${car}_move`);
      const tap = createText(this, cx, cy + 50, 'タップしてはじめる', 8).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
      createText(this, cx, viewport.height - viewport.safe.bottom - 10, `build ${__BUILD_TIME__}`, 6, '#566c86').setOrigin(0.5);
    };
    layout();
    EventBus.on(GameEvents.ViewportChanged, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off(GameEvents.ViewportChanged, layout));

    // 今の章の拠点から始める
    const start = () => this.scene.start('Town', { areaId: CHAPTERS[gameState.story.chapter]?.startArea ?? 'town' });
    this.input.once('pointerup', start);
    this.input.keyboard?.once('keydown', start);
  }
}

import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { viewport } from '../core/Viewport';
import { JOBS } from '../data/jobs';
import { closeOverlay } from '../ui/overlay';
import { createText } from '../ui/text';

/**
 * 過去の映像（記憶の結晶に触れたとき）。
 * セピア色の古い記録映像のように、沈む前の都市の道を、今と同じ FIT が走っていく
 */
export class FlashbackScene extends Phaser.Scene {
  private onComplete?: () => void;
  private done = false;

  constructor() {
    super('Flashback');
  }

  init(data: { onComplete?: () => void }) {
    this.onComplete = data.onComplete;
    this.done = false;
  }

  create() {
    const { width: W, height: H } = viewport;
    const cam = this.cameras.main;
    cam.setZoom(viewport.zoom).setOrigin(0, 0);
    const SEPIA_DARK = 0x3b2a1a;
    const SEPIA = 0xa8844f;
    const SEPIA_LIGHT = 0xe4d4b4;

    this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0);
    const scene = this.add.container(0, 0).setAlpha(0);

    // 空と、沈む前の都市のシルエット
    const g = this.add.graphics();
    g.fillStyle(SEPIA_LIGHT, 1).fillRect(0, 0, W, H);
    const horizon = H * 0.55;
    g.fillStyle(SEPIA, 1);
    let x = 0;
    let seed = 7;
    while (x < W) {
      seed = (seed * 9301 + 49297) % 233280;
      const bw = 10 + (seed % 18);
      const bh = 20 + ((seed >> 3) % 60);
      g.fillRect(x, horizon - bh, bw - 2, bh);
      x += bw;
    }
    // 道路
    g.fillStyle(SEPIA_DARK, 1).fillRect(0, horizon, W, H - horizon);
    g.fillStyle(SEPIA_LIGHT, 0.7);
    for (let lx = 0; lx < W; lx += 18) g.fillRect(lx, horizon + 22, 9, 2);
    scene.add(g);

    // 今と同じ FIT（今のジョブの車）が走ってくる
    const carKey = JOBS[gameState.currentJob].sprite;
    const car = this.add.sprite(-20, horizon + 16, carKey, 0).setScale(2).setTint(0xc8a070).play(`${carKey}_move`);
    scene.add(car);
    this.tweens.add({ targets: car, x: W * 0.5, duration: 2200, ease: 'Quad.easeOut', delay: 400 });

    // 古い映像のような走査線とノイズ
    const lines = this.add.graphics();
    lines.fillStyle(0x000000, 0.18);
    for (let y = 0; y < H; y += 3) lines.fillRect(0, y, W, 1);
    scene.add(lines);
    const noise = this.add.graphics();
    scene.add(noise);
    this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        noise.clear();
        noise.fillStyle(0xffffff, 0.25);
        for (let i = 0; i < 10; i++) noise.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 20, 1);
        // ときどき映像が横にずれる
        scene.x = Math.random() < 0.12 ? (Math.random() - 0.5) * 6 : 0;
      },
    });

    const caption = createText(this, 6, 6, '記録 No.???  再生中', 6, '#3b2a1a');
    scene.add(caption);
    this.tweens.add({ targets: caption, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });

    // 白い光 → 映像が浮かび上がる → 消える
    cam.flash(400, 255, 255, 255);
    this.tweens.add({ targets: scene, alpha: 1, duration: 500 });
    this.time.delayedCall(3600, () => this.finish());
    // 1秒たったらタップで飛ばせる
    this.time.delayedCall(1000, () => this.input.once('pointerup', () => this.finish()));
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(400, 255, 255, 255);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const cb = this.onComplete;
      closeOverlay(this);
      cb?.();
    });
  }
}

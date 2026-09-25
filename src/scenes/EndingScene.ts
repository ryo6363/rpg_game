import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { viewport } from '../core/Viewport';
import { JOBS } from '../data/jobs';
import { startNextLoop } from '../systems/Story';
import { createText, wrapJa } from '../ui/text';

/** エンディングの1場面：絵を描く関数と、その場面の文 */
interface Cut {
  draw: (c: Phaser.GameObjects.Container) => void;
  lines: { s?: string; t: string }[];
}

/**
 * エンディング。世界が静かになり、道路・街・森・水没都市が元に戻っていく。
 * 最後に FIT が最初の街へ向かい、暗転してタイトル（NEW LOOP）へ。
 * 画面をタップすると文が先へ進む
 */
export class EndingScene extends Phaser.Scene {
  private cuts: Cut[] = [];
  private cutIndex = -1;
  private lineIndex = 0;
  private stage!: Phaser.GameObjects.Container;
  private text!: Phaser.GameObjects.Text;
  private speaker!: Phaser.GameObjects.Text;
  private timer: Phaser.Time.TimerEvent | null = null;
  private ending = false;

  constructor() {
    super('Ending');
  }

  create() {
    const { width: W, height: H } = viewport;
    // 操作ボタンや HP などは出さない
    if (this.scene.isActive('UI') || this.scene.isSleeping('UI')) this.scene.stop('UI');
    this.scene.bringToTop();
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0).setBackgroundColor('#000000');
    this.cutIndex = -1;
    this.ending = false;
    this.stage = this.add.container(0, 0);
    this.add.rectangle(0, H - 70, W, 70, 0x000000, 0.75).setOrigin(0).setDepth(10);
    this.speaker = createText(this, 12, H - 64, '', 6, '#ffd23f').setDepth(11);
    this.text = createText(this, W / 2, H - 38, '', 8, '#f4f4f4', { align: 'center' }).setOrigin(0.5).setDepth(11);

    this.cuts = [
      { draw: (c) => this.drawSilence(c), lines: [{ t: '世界が、静かになる。' }] },
      { draw: (c) => this.drawRoad(c), lines: [{ t: '崩れていた道路が、元に戻っていく。' }] },
      { draw: (c) => this.drawTown(c), lines: [{ t: '街が、よみがえる。' }] },
      { draw: (c) => this.drawForest(c), lines: [{ t: '森に、光が戻る。' }] },
      { draw: (c) => this.drawWater(c), lines: [{ t: '水没していた都市から、水が引いていく。' }] },
      {
        draw: (c) => this.drawDrive(c),
        lines: [
          { t: 'FIT は、まっすぐな道を走っていく。' },
          { t: '遠くに、最初の街が見える。' },
          { s: 'ナビ', t: '目的地に到着しました。' },
          { s: '主人公', t: '……ここから始まったんだな。' },
          { t: '主人公は、街へ入っていった。' },
        ],
      },
    ];
    this.input.on('pointerup', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-J', () => this.advance());
    this.cameras.main.fadeIn(1200, 255, 255, 255);
    this.time.delayedCall(800, () => this.nextCut());
  }

  // ------------------------------------------------------------ 進行

  private nextCut() {
    this.cutIndex++;
    if (this.cutIndex >= this.cuts.length) {
      this.finish();
      return;
    }
    const old = this.stage;
    this.tweens.add({ targets: old, alpha: 0, duration: 500, onComplete: () => old.destroy() });
    this.stage = this.add.container(0, 0).setAlpha(0);
    this.cuts[this.cutIndex].draw(this.stage);
    this.tweens.add({ targets: this.stage, alpha: 1, duration: 700 });
    this.lineIndex = 0;
    this.showLine();
  }

  private showLine() {
    const cut = this.cuts[this.cutIndex];
    const line = cut.lines[this.lineIndex];
    const { width: W } = viewport;
    this.speaker.setText(line.s ?? '');
    this.text.setText(wrapJa(line.t, W - 24, 8)).setAlpha(0);
    this.tweens.add({ targets: this.text, alpha: 1, duration: 400 });
    this.timer?.remove();
    this.timer = this.time.delayedCall(2800, () => this.advance());
  }

  private advance() {
    if (this.ending || this.cutIndex < 0) return;
    const cut = this.cuts[this.cutIndex];
    this.lineIndex++;
    if (this.lineIndex < cut.lines.length) this.showLine();
    else this.nextCut();
  }

  /** 暗転 → 2周目へ（タイトルに NEW LOOP） */
  private finish() {
    this.ending = true;
    this.timer?.remove();
    this.speaker.setText('');
    this.text.setText('');
    this.cameras.main.fadeOut(1500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      startNextLoop();
      this.scene.start('Title', { newLoop: true });
    });
  }

  // ------------------------------------------------------------ 場面

  private sky(c: Phaser.GameObjects.Container, top: number, bottom: number) {
    const { width: W, height: H } = viewport;
    const g = this.add.graphics();
    g.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, W, H);
    c.add(g);
    return g;
  }

  /** 静寂：暗闇の中を、光の粒がゆっくり昇っていく */
  private drawSilence(c: Phaser.GameObjects.Container) {
    const { width: W, height: H } = viewport;
    for (let i = 0; i < 40; i++) {
      const dot = this.add.rectangle(Math.random() * W, H * (0.3 + Math.random() * 0.6), 1, 1, i % 3 ? 0xf4f4f4 : 0xffcd75, 1);
      c.add(dot);
      this.tweens.add({ targets: dot, y: dot.y - 60 - Math.random() * 60, alpha: 0, duration: 3000 + Math.random() * 2000, repeat: -1, delay: Math.random() * 2000 });
    }
  }

  /** 道路：ばらばらだった道路のかけらが、元の位置へ戻ってつながる */
  private drawRoad(c: Phaser.GameObjects.Container) {
    const { width: W, height: H } = viewport;
    this.sky(c, 0x1a1c2c, 0x29366f);
    const y = H * 0.45;
    for (let i = 0; i < 8; i++) {
      const seg = this.add.container(i * (W / 8) + W / 16, y);
      seg.add(this.add.rectangle(0, 0, W / 8, 28, 0x333c57, 1));
      seg.add(this.add.rectangle(0, 0, W / 16, 2, 0xffcd75, 1));
      seg.setPosition(seg.x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 160).setAngle((Math.random() - 0.5) * 90).setAlpha(0.4);
      c.add(seg);
      this.tweens.add({ targets: seg, x: i * (W / 8) + W / 16, y, angle: 0, alpha: 1, duration: 1400, delay: 300 + i * 120, ease: 'Quad.easeOut' });
    }
  }

  /** 街：建物が浮かび上がり、窓に明かりがともる */
  private drawTown(c: Phaser.GameObjects.Container) {
    const { width: W, height: H } = viewport;
    this.sky(c, 0x29366f, 0xef7d57);
    const ground = H * 0.62;
    let x = 0;
    let seed = 11;
    while (x < W) {
      seed = (seed * 9301 + 49297) % 233280;
      const bw = 14 + (seed % 16);
      const bh = 30 + ((seed >> 3) % 70);
      const b = this.add.container(x, ground + bh);
      b.add(this.add.rectangle(0, 0, bw - 2, bh, 0x1a1c2c, 1).setOrigin(0, 1));
      for (let wy = 6; wy < bh - 6; wy += 9) {
        for (let wx = 3; wx < bw - 6; wx += 6) {
          const win = this.add.rectangle(wx, -bh + wy, 2, 3, 0xffcd75, 1).setOrigin(0).setAlpha(0);
          b.add(win);
          this.tweens.add({ targets: win, alpha: Math.random() < 0.7 ? 1 : 0.3, delay: 1200 + Math.random() * 1400, duration: 200 });
        }
      }
      c.add(b);
      this.tweens.add({ targets: b, y: ground, duration: 1200, delay: Math.random() * 500, ease: 'Back.easeOut' });
      x += bw;
    }
    c.add(this.add.rectangle(0, ground, W, H - ground, 0x333c57, 1).setOrigin(0));
  }

  /** 森：灰色だった木々に、上から光が差して緑が戻る */
  private drawForest(c: Phaser.GameObjects.Container) {
    const { width: W, height: H } = viewport;
    this.sky(c, 0x257179, 0xa7f070);
    const ground = H * 0.6;
    c.add(this.add.rectangle(0, ground, W, H - ground, 0x2f6b3c, 1).setOrigin(0));
    const trees: Phaser.GameObjects.Triangle[] = [];
    for (let i = 0; i < 9; i++) {
      const tx = (i + 0.5) * (W / 9) + (Math.random() - 0.5) * 8;
      const th = 40 + Math.random() * 40;
      const gray = this.add.triangle(tx, ground, -10, 0, 10, 0, 0, -th, 0x566c86).setOrigin(0, 0);
      const green = this.add.triangle(tx, ground, -10, 0, 10, 0, 0, -th, 0x38b764).setOrigin(0, 0).setAlpha(0);
      c.add([gray, green]);
      trees.push(green);
    }
    // 光の筋
    for (let i = 0; i < 3; i++) {
      const ray = this.add.triangle(W * (0.2 + i * 0.3), 0, -6, 0, 6, 0, 30, ground, 0xffcd75, 0.25).setOrigin(0, 0).setAlpha(0);
      c.add(ray);
      this.tweens.add({ targets: ray, alpha: 1, delay: 500 + i * 300, duration: 800 });
    }
    trees.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, delay: 1000 + i * 120, duration: 600 }));
  }

  /** 水没都市：街をおおっていた水が引いていく */
  private drawWater(c: Phaser.GameObjects.Container) {
    const { width: W, height: H } = viewport;
    this.sky(c, 0x41a6f6, 0xe4d4b4);
    const ground = H * 0.66;
    let x = 4;
    let seed = 5;
    while (x < W) {
      seed = (seed * 9301 + 49297) % 233280;
      const bw = 12 + (seed % 14);
      const bh = 40 + ((seed >> 3) % 60);
      c.add(this.add.rectangle(x, ground, bw - 3, bh, 0x566c86, 1).setOrigin(0, 1));
      x += bw;
    }
    c.add(this.add.rectangle(0, ground, W, H - ground, 0x7a6f60, 1).setOrigin(0));
    const water = this.add.rectangle(0, H * 0.25, W, H, 0x3b5dc9, 0.75).setOrigin(0);
    c.add(water);
    this.tweens.add({ targets: water, y: ground + 4, duration: 2600, delay: 300, ease: 'Sine.easeInOut' });
  }

  /** FIT が最初の街へ向かう */
  private drawDrive(c: Phaser.GameObjects.Container) {
    const { width: W, height: H } = viewport;
    this.sky(c, 0x73eff7, 0xffcd75);
    const horizon = H * 0.4;
    // 遠くの街
    const town = this.add.container(W / 2, horizon);
    [[-18, 14], [-10, 22], [-2, 16], [6, 26], [14, 18]].forEach(([dx, h]) => town.add(this.add.rectangle(dx, 0, 7, h, 0x333c57, 1).setOrigin(0.5, 1)));
    town.setScale(0.6);
    c.add(town);
    this.tweens.add({ targets: town, scale: 1.6, duration: 14000, ease: 'Quad.easeIn' });
    // 野原と、街へまっすぐ続く道路
    c.add(this.add.rectangle(0, horizon, W, H - horizon, 0x5aa35a, 1).setOrigin(0));
    const road = this.add.graphics();
    road.fillStyle(0x333c57, 1).fillPoints(
      [
        { x: W / 2 - 3, y: horizon },
        { x: W / 2 + 3, y: horizon },
        { x: W / 2 + W * 0.45, y: H },
        { x: W / 2 - W * 0.45, y: H },
      ],
      true,
    );
    c.add(road);
    for (let i = 0; i < 6; i++) {
      const dash = this.add.rectangle(W / 2, horizon + 10 + i * 40, 2, 10, 0xffcd75, 1);
      c.add(dash);
      this.tweens.add({ targets: dash, y: H, duration: 1600, delay: i * 260, repeat: -1 });
    }
    // 主人公の FIT
    const key = JOBS[gameState.currentJob].sprite;
    const car = this.add.sprite(W / 2, H - 110, key, 0).setScale(3).play(`${key}_move`);
    c.add(car);
    this.tweens.add({ targets: car, y: car.y - 3, duration: 300, yoyo: true, repeat: -1 });
  }
}

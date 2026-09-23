import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { viewport } from '../core/Viewport';
import { sceneForArea } from '../data/areas';
import { CHAPTERS } from '../data/chapters';
import { currentLoop, startNextLoop } from '../systems/Story';
import { closeOverlay } from '../ui/overlay';
import { createText } from '../ui/text';

/**
 * 章クリア画面。
 * 次の章が遊べるならそこへ、準備中なら「探索をつづける／周回する」、最終章なら周回へ。
 */
export class ChapterClearScene extends Phaser.Scene {
  private chapter = 1;

  constructor() {
    super('ChapterClear');
  }

  init(data: { chapter: number }) {
    this.chapter = data.chapter ?? gameState.story.chapter;
  }

  create() {
    const { width: W, height: H } = viewport;
    const cx = W / 2;
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    const bg = this.add.rectangle(0, 0, W, H, 0x1a1c2c, 1).setOrigin(0).setAlpha(0);
    this.tweens.add({ targets: bg, alpha: 1, duration: 600 });

    const ch = CHAPTERS[this.chapter];
    const items = [
      createText(this, cx, H * 0.3, `第${ch.id}章`, 8, '#94b0c2').setOrigin(0.5),
      createText(this, cx, H * 0.3 + 16, ch.title, 16, '#f4f4f4').setOrigin(0.5),
      createText(this, cx, H * 0.3 + 36, '― CLEAR ―', 10, '#ffd23f').setOrigin(0.5),
    ];
    items.forEach((t, i) => {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, delay: 700 + i * 350, duration: 500 });
    });

    this.time.delayedCall(2000, () => this.showNext());
  }

  private showNext() {
    const { width: W, height: H } = viewport;
    const cx = W / 2;
    const next = CHAPTERS[this.chapter]?.next;
    const nextCh = next ? CHAPTERS[next] : undefined;
    let y = H * 0.55;

    if (nextCh?.available) {
      this.text(cx, y, `次は 第${nextCh.id}章「${nextCh.title}」`, 8, '#f4f4f4');
      this.button(cx, y + 24, 'つぎへ', 0x257179, () => {
        gameState.story.chapter = nextCh.id;
        SaveManager.save();
        this.scene.start(sceneForArea(nextCh.startArea), { areaId: nextCh.startArea });
      });
      return;
    }

    if (nextCh) {
      this.text(cx, y, `第${nextCh.id}章「${nextCh.title}」は準備中です`, 8, '#94b0c2');
      y += 24;
      this.button(cx, y, '探索をつづける', 0x333c57, () => closeOverlay(this));
      y += 22;
    }
    this.button(cx, y, `周回する（${currentLoop() + 1}周目へ）`, 0xb8860b, () => this.startLoop());
    this.text(cx, y + 16, '敵が強くなり、レアが出やすくなる。装備とレベルは引きつぐ', 6, '#94b0c2');
  }

  /** 周回開始：タイトル風の演出のあと、第1章の街から */
  private startLoop() {
    startNextLoop();
    this.children.removeAll(true);
    const { width: W, height: H } = viewport;
    this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0);
    const title = createText(this, W / 2, H * 0.42, 'FIT QUEST', 16, '#f4f4f4').setOrigin(0.5).setAlpha(0);
    const start = createText(this, W / 2, H * 0.42 + 26, 'GAME START', 8, '#ffd23f').setOrigin(0.5).setAlpha(0);
    const loop = createText(this, W / 2, H * 0.42 + 44, `${currentLoop()}周目`, 6, '#94b0c2').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, delay: 500, duration: 900 });
    this.tweens.add({ targets: [start, loop], alpha: 1, delay: 2000, duration: 600 });
    this.time.delayedCall(3600, () => this.scene.start('Town', { areaId: 'town' }));
  }

  private text(x: number, y: number, str: string, size: number, color: string) {
    return createText(this, x, y, str, size, color).setOrigin(0.5);
  }

  private button(cx: number, y: number, label: string, color: number, onTap: () => void) {
    const w = 120;
    const h = 16;
    const x = cx - w / 2;
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRect(x, y - h / 2, w, h);
    g.lineStyle(1, 0xf4f4f4, 0.8).strokeRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
    this.text(cx, y, label, 8, '#f4f4f4');
    const z = this.add.zone(x, y - h / 2, w, h).setOrigin(0).setInteractive();
    z.on('pointerup', () => this.time.delayedCall(0, onTap));
  }
}

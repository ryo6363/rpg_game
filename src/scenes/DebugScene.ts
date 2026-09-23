import Phaser from 'phaser';
import { EXP } from '../config/balance';
import { DebugState } from '../core/DebugState';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { viewport } from '../core/Viewport';
import { AREAS } from '../data/areas';
import { CHAPTERS } from '../data/chapters';
import { JOBS } from '../data/jobs';
import { createText } from '../ui/text';

/**
 * 隠しデバッグメニュー（タイトル画面のロゴを3秒以内に5回タップ／キーボードで DEBUG）。
 * 各エリア・ボスステージへ直接飛べる。
 */
export class DebugScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;

  constructor() {
    super('Debug');
  }

  create() {
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0).setBackgroundColor('#1a1c2c');
    this.root = this.add.container(0, 0);
    this.refresh();
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Title'));
  }

  private refresh() {
    this.root.removeAll(true);
    const { width: W, safe } = viewport;
    const left = safe.left + 6;
    const right = W - safe.right - 6;
    let y = safe.top + 4;

    this.put(createText(this, left, y, 'DEBUG MENU', 8, '#ef7d57'));
    this.button(right - 30, y - 1, 30, 12, '戻る', 0x333c57, () => this.scene.start('Title'));
    y += 14;
    const job = JOBS[gameState.currentJob];
    const prog = gameState.jobs[job.id];
    this.put(
      createText(
        this,
        left,
        y,
        `${gameState.story.loop}周目・第${gameState.story.chapter}章 / ${job.name} Lv${prog.level} / ${gameState.gold}G`,
        6,
        '#94b0c2',
      ),
    );
    y += 11;

    // ---- テスト用の切り替え
    const bw = Math.floor((right - left - 6) / 3);
    this.button(left, y, bw, 13, `無敵 ${DebugState.invincible ? 'ON' : 'OFF'}`, DebugState.invincible ? 0xb13e53 : 0x333c57, () => {
      DebugState.invincible = !DebugState.invincible;
      this.refresh();
    });
    this.button(left + bw + 3, y, bw, 13, 'Lv+5', 0x257179, () => {
      prog.level = Math.min(EXP.maxLevel, prog.level + 5);
      prog.exp = 0;
      SaveManager.save();
      this.refresh();
    });
    this.button(left + (bw + 3) * 2, y, bw, 13, '+1000G', 0xb8860b, () => {
      gameState.gold += 1000;
      SaveManager.save();
      this.refresh();
    });
    y += 20;

    // ---- エリア一覧（章ごと）
    for (const ch of Object.values(CHAPTERS)) {
      const areas = Object.values(AREAS).filter((a) => a.chapter === ch.id);
      if (areas.length === 0) continue;
      this.put(createText(this, left, y, `第${ch.id}章 ${ch.title}`, 6, '#ffd23f'));
      y += 9;
      for (const area of areas) {
        const kind = area.boss ? 'ボス' : area.type === 'town' ? '街' : `Lv${area.level}`;
        const color = area.boss ? 0x5d275d : area.type === 'town' ? 0x29366f : 0x333c57;
        this.button(left, y, right - left, 13, `${area.name}（${kind}）`, color, () => this.warp(area.id));
        y += 15;
      }
      y += 3;
    }
  }

  /** エリアへ飛ぶ。ボスステージならボスをもう一度出す */
  private warp(areaId: string) {
    const area = AREAS[areaId];
    if (area.boss) {
      gameState.story.flags = gameState.story.flags.filter((f) => f !== `defeated_${area.boss!.id}`);
    }
    SaveManager.save();
    this.scene.start(area.type === 'town' ? 'Town' : 'Field', { areaId });
  }

  private put<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.root.add(obj);
    return obj;
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: number, onTap: () => void) {
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRect(x, y, w, h);
    g.lineStyle(1, 0xf4f4f4, 0.6).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.put(g);
    this.put(createText(this, x + w / 2, y + h / 2, label, 6, '#f4f4f4').setOrigin(0.5));
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    z.on('pointerup', () => this.time.delayedCall(0, onTap));
    this.put(z);
  }
}

import Phaser from 'phaser';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import type { JobId } from '../core/types';
import { viewport } from '../core/Viewport';
import { JOBS } from '../data/jobs';
import { SKILLS } from '../data/skills';
import { closeOverlay } from '../ui/overlay';
import { createText } from '../ui/text';

/** ガレージ：ジョブ（車）の切り替え。レベルはジョブごとに別 */
export class JobSelectScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;

  constructor() {
    super('JobSelect');
  }

  create() {
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    this.add.rectangle(0, 0, viewport.width, viewport.height, 0x1a1c2c, 0.94).setOrigin(0);
    this.root = this.add.container(0, 0);
    this.refresh();
    this.input.keyboard?.on('keydown-ESC', () => closeOverlay(this));
  }

  private refresh() {
    this.root.removeAll(true);
    const { width: W, height: H, safe } = viewport;
    const left = safe.left + 6;
    const right = W - safe.right - 6;
    let y = safe.top + 4;

    this.put(createText(this, left, y, 'ガレージ：ジョブを選ぶ', 8));
    this.button(right - 14, y - 1, 14, 12, '×', 0x333c57, true, () => closeOverlay(this));
    y += 16;

    const ids = Object.keys(JOBS) as JobId[];
    const cardH = Math.min(96, Math.floor((H - safe.bottom - 6 - y) / ids.length) - 4);
    for (const id of ids) {
      this.card(id, left, y, right - left, cardH);
      y += cardH + 4;
    }
  }

  private card(id: JobId, x: number, y: number, w: number, h: number) {
    const job = JOBS[id];
    const current = gameState.currentJob === id;
    const prog = gameState.jobs[id];

    const g = this.add.graphics();
    g.fillStyle(current ? 0x29366f : 0x333c57, 0.8).fillRect(x, y, w, h);
    g.lineStyle(1, current ? 0xffd23f : 0x566c86, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.put(g);

    // 車（2倍の整数拡大）
    this.put(this.add.image(x + 18, y + 18, job.sprite, 0).setScale(2));
    this.put(createText(this, x + 36, y + 4, job.name, 8, current ? '#ffd23f' : '#f4f4f4'));
    this.put(createText(this, x + 36, y + 15, `Lv${prog.level}`, 6, '#a7f070'));
    this.put(
      createText(this, x + 36, y + 24, job.description, 6, '#94b0c2', { wordWrap: { width: w - 40, useAdvancedWrap: true } }),
    );

    // スキル一覧（解放レベル付き）
    let sy = y + 40;
    for (const s of job.skills) {
      const unlocked = prog.level >= s.unlockLevel;
      const label = `${unlocked ? '●' : '○'} ${SKILLS[s.id].name}${unlocked ? '' : `（Lv${s.unlockLevel}）`}`;
      if (sy + 8 > y + h - 15) break;
      this.put(createText(this, x + 6, sy, label, 6, unlocked ? '#f4f4f4' : '#566c86'));
      sy += 8;
    }

    const bw = 64;
    this.button(x + w - bw - 4, y + h - 15, bw, 12, current ? '選択中' : 'この車で出る', 0x257179, !current, () => {
      gameState.currentJob = id;
      SaveManager.save();
      EventBus.emit(GameEvents.JobChanged);
      closeOverlay(this);
    });
  }

  private put<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.root.add(obj);
    return obj;
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: number, enabled: boolean, onTap: () => void) {
    const g = this.add.graphics();
    g.fillStyle(color, enabled ? 1 : 0.3).fillRect(x, y, w, h);
    g.lineStyle(1, 0xf4f4f4, enabled ? 0.8 : 0.2).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.root.add(g);
    this.root.add(createText(this, x + w / 2, y + h / 2, label, 6, enabled ? '#f4f4f4' : '#94b0c2').setOrigin(0.5));
    if (enabled) {
      const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
      z.on('pointerup', () => this.time.delayedCall(0, onTap));
      this.root.add(z);
    }
  }
}

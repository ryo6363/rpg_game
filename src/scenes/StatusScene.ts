import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import type { StatAllocKey, StatKey } from '../core/types';
import { viewport } from '../core/Viewport';
import { STAT_META } from '../data/itemMeta';
import { JOBS } from '../data/jobs';
import { allocationBonusText, STAT_ALLOC_META, STAT_ALLOC_ORDER } from '../data/statPoints';
import { currentStats } from '../systems/Equipment';
import { formatStat } from '../systems/Items';
import { allocateStatPoint, statPointsOf } from '../systems/StatPoints';
import { closeOverlay } from '../ui/overlay';
import { createText } from '../ui/text';

/**
 * ステータス画面（ステータスポイントの振り分け）。画面右上の持ち物ボタンの横から開く（開いている間フィールドは止まる）。
 * 「＋」を押すと1ポイント使って、その項目を1段階強化する
 */
export class StatusScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  /** 開いた直後のタップを無視する */
  private readyAt = 0;
  /** 直前に強化した項目（光らせる） */
  private lastUp: StatAllocKey | null = null;

  constructor() {
    super('Status');
  }

  create() {
    this.readyAt = this.time.now + 250;
    this.lastUp = null;
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    this.add.rectangle(0, 0, viewport.width, viewport.height, 0x1a1c2c, 0.97).setOrigin(0);
    this.root = this.add.container(0, 0);
    this.refresh();
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-C', () => this.close());
  }

  private close() {
    SaveManager.save();
    closeOverlay(this);
  }

  private refresh() {
    this.root.removeAll(true);
    const { width: W, height: H, safe } = viewport;
    const left = safe.left + 8;
    const right = W - safe.right - 8;
    const job = JOBS[gameState.currentJob];
    const level = gameState.jobs[gameState.currentJob].level;
    const ps = statPointsOf();
    let y = safe.top + 6;

    // ---- 見出し
    this.button(right - 14, y - 2, 14, 12, '×', 0x333c57, true, () => this.close());
    this.line(left, right, y + 13);
    this.text((left + right) / 2, y + 3, 'STATUS', 8, '#f4f4f4').setOrigin(0.5, 0);
    y += 18;
    this.text(left, y, `${job.name}  Lv${level}`, 6, '#94b0c2');
    y += 12;
    this.text(left, y, `未使用ポイント：${ps.statPoints}`, 8, ps.statPoints > 0 ? '#ffd23f' : '#94b0c2');
    y += 16;

    // ---- 振り分け
    const rowH = 20;
    for (const key of STAT_ALLOC_ORDER) {
      const meta = STAT_ALLOC_META[key];
      const pts = ps.allocatedStats[key];
      if (this.lastUp === key) {
        const glow = this.add.rectangle(left - 3, y - 3, right - left + 6, rowH - 2, 0xffd23f, 0.25).setOrigin(0);
        this.root.add(glow);
        this.tweens.add({ targets: glow, alpha: 0, duration: 500 });
      }
      this.text(left, y + 2, meta.label, 8, '#f4f4f4');
      this.text(left + 62, y + 2, `Lv ${pts}`, 8, pts > 0 ? '#f4f4f4' : '#566c86');
      this.text(left + 96, y + 4, allocationBonusText(key, pts), 6, pts > 0 ? '#a7f070' : '#566c86');
      const can = ps.statPoints > 0;
      this.button(right - 20, y, 20, 14, '＋', can ? 0x257179 : 0x333c57, can, () => {
        if (!allocateStatPoint(key)) return;
        this.lastUp = key;
        this.refresh();
      });
      y += rowH;
    }
    this.line(left, right, y);
    y += 6;

    // ---- 今のステータス（装備・ポイント込み）
    this.text(left, y, '今のステータス（装備込み）', 6, '#94b0c2');
    y += 10;
    const s = currentStats();
    const cell = (k: StatKey) => `${STAT_META[k].label} ${formatStat(k, s[k])}`;
    const cols: StatKey[][] = [
      ['maxHp', 'atk', 'def'],
      ['moveSpeed', 'critRate', 'critDamage'],
    ];
    cols.forEach((keys, c) => {
      keys.forEach((k, r) => this.text(left + c * ((right - left) / 2), y + r * 10, cell(k), 6, '#f4f4f4'));
    });
    y += 34;

    // ---- 説明
    const notes = [
      'レベルが1上がるごとに1ポイントもらえます。',
      'ポイントはジョブごとに別々です。',
      '振ったポイントは、今は戻せません。',
    ];
    notes.forEach((n, i) => this.text(left, Math.min(y, H - safe.bottom - 34) + i * 9, n, 6, '#566c86'));
  }

  // ------------------------------------------------------------ 部品

  private text(x: number, y: number, str: string, size: number, color: string) {
    const t = createText(this, x, y, str, size, color);
    this.root.add(t);
    return t;
  }

  private line(x0: number, x1: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0x566c86, 1).fillRect(x0, y, x1 - x0, 1);
    this.root.add(g);
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: number, enabled: boolean, onTap: () => void) {
    const g = this.add.graphics();
    g.fillStyle(color, enabled ? 1 : 0.35).fillRect(x, y, w, h);
    g.lineStyle(1, 0xf4f4f4, enabled ? 0.8 : 0.2).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.root.add(g);
    this.text(x + w / 2, y + h / 2, label, 8, enabled ? '#f4f4f4' : '#566c86').setOrigin(0.5);
    if (!enabled) return;
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    z.on('pointerup', () => {
      if (this.time.now < this.readyAt) return;
      this.time.delayedCall(0, onTap);
    });
    this.root.add(z);
  }
}

import Phaser from 'phaser';
import { LOOT } from '../config/balance';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import type { ItemInstance, Slot, StatKey, Stats } from '../core/types';
import { viewport } from '../core/Viewport';
import { ITEM_BASES } from '../data/itemBases';
import { RARITY_META, SLOT_META, SLOT_ORDER, STAT_META, STAT_ORDER } from '../data/itemMeta';
import { JOBS } from '../data/jobs';
import {
  autoEquipBest,
  canEquip,
  currentStats,
  equipFromInventory,
  getEquipped,
  isInventoryFull,
  sellItem,
  statsIfEquipped,
  statsIfUnequipped,
  unequip,
} from '../systems/Equipment';
import { formatStat, itemLines, itemSlot, sellPrice } from '../systems/Items';
import { applyColor, rainbowNow, rarityTextColor } from '../ui/rarityStyle';
import { createText } from '../ui/text';

type Selection = { kind: 'bag'; item: ItemInstance } | { kind: 'equip'; slot: Slot } | null;

const CELL = 20;
const GAP = 2;
const BAG_COLS = 7;

/** 持ち物・装備画面。開いている間フィールドは一時停止する */
export class InventoryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private selection: Selection = null;
  /** レア以上の売却は2回押しで確定 */
  private sellArmed: ItemInstance | null = null;
  /** 詳細欄に一時的に出すメッセージ */
  private notice: string | null = null;
  /** 虹色の枠を描くマス（レジェンダリー） */
  private rainbowCells: { g: Phaser.GameObjects.Graphics; x: number; y: number }[] = [];

  constructor() {
    super('Inventory');
  }

  create() {
    this.notice = null;
    this.selection = null;
    this.sellArmed = null;
    this.cameras.main.setZoom(viewport.zoom).setOrigin(0, 0);
    this.add.rectangle(0, 0, viewport.width, viewport.height, 0x1a1c2c, 0.94).setOrigin(0);
    this.root = this.add.container(0, 0);
    this.refresh();

    const kb = this.input.keyboard!;
    kb.on('keydown-I', () => this.close());
    kb.on('keydown-ESC', () => this.close());
  }

  private close() {
    SaveManager.save();
    this.scene.stop();
    this.scene.resume('Field');
    this.scene.wake('UI');
  }

  // ------------------------------------------------------------ 描画

  private refresh() {
    this.root.removeAll(true);
    this.rainbowCells = [];
    const { width: W, height: H, safe } = viewport;
    const left = safe.left + 6;
    const right = W - safe.right - 6;
    let y = safe.top + 4;

    // ---- ヘッダー
    const job = JOBS[gameState.currentJob];
    this.text(left, y, `持ち物 ${gameState.inventory.length}/${LOOT.inventorySize}`, 8);
    this.text(right - 18, y + 1, `${gameState.gold} G`, 8, '#ffcd75').setOrigin(1, 0);
    this.button(right - 14, y - 1, 14, 12, '×', 0x333c57, true, () => this.close());
    y += 14;

    // ---- 装備中
    this.text(left, y + 2, `装備中（${job.name}）`, 6, '#94b0c2');
    this.button(right - 44, y, 44, 11, '最強装備', 0xb8860b, true, () => {
      const n = autoEquipBest();
      this.selection = null;
      this.sellArmed = null;
      this.notice = n > 0 ? `${n}か所を最強の装備に付け替えた` : 'すでに最強の装備です';
      this.refresh();
    });
    y += 13;
    const eqW = SLOT_ORDER.length * CELL + (SLOT_ORDER.length - 1) * GAP;
    let x = Math.round((W - eqW) / 2);
    for (const slot of SLOT_ORDER) {
      const item = getEquipped(slot);
      const selected = this.selection?.kind === 'equip' && this.selection.slot === slot;
      this.cell(x, y, item, SLOT_META[slot].icon, selected, () => this.select({ kind: 'equip', slot }));
      x += CELL + GAP;
    }
    y += CELL + 4;

    // ---- ステータス
    const s = currentStats();
    const statLine = (keys: StatKey[]) => keys.map((k) => `${STAT_META[k].short}${formatStat(k, s[k])}`).join('  ');
    this.text(left, y, statLine(['maxHp', 'atk', 'def', 'moveSpeed']), 6);
    this.text(left, y + 8, statLine(['critRate', 'critDamage', 'attackSpeed']), 6);
    y += 19;

    // ---- 持ち物
    const bagW = BAG_COLS * CELL + (BAG_COLS - 1) * GAP;
    const bagX = Math.round((W - bagW) / 2);
    for (let i = 0; i < LOOT.inventorySize; i++) {
      const cx = bagX + (i % BAG_COLS) * (CELL + GAP);
      const cy = y + Math.floor(i / BAG_COLS) * (CELL + GAP);
      const item = gameState.inventory[i] ?? null;
      const selected = !!item && this.selection?.kind === 'bag' && this.selection.item === item;
      this.cell(cx, cy, item, null, selected, item ? () => this.select({ kind: 'bag', item }) : undefined);
    }
    y += Math.ceil(LOOT.inventorySize / BAG_COLS) * (CELL + GAP) + 3;

    // ---- 詳細
    this.drawDetail(left, y, right - left, H - safe.bottom - 4 - y);
  }

  private drawDetail(x: number, y: number, w: number, h: number) {
    const g = this.add.graphics();
    g.fillStyle(0x333c57, 0.6).fillRect(x, y, w, h);
    g.lineStyle(1, 0x566c86, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.root.add(g);

    const sel = this.selection;
    const item = sel?.kind === 'bag' ? sel.item : sel?.kind === 'equip' ? getEquipped(sel.slot) : null;
    if (!sel || !item) {
      const msg = sel?.kind === 'equip' ? `${SLOT_META[sel.slot].label}：なし` : 'アイテムをタップしてください';
      this.text(x + 4, y + 4, msg, 6, '#94b0c2');
      if (this.notice) this.text(x + 4, y + 14, this.notice, 6, '#ffd23f');
      return;
    }

    const base = ITEM_BASES[item.baseId];
    const meta = RARITY_META[item.rarity];
    const px = x + 4;
    let py = y + 3;
    applyColor(this.text(px, py, item.name, 8), rarityTextColor(item.rarity));
    py += 11;
    const where = sel.kind === 'equip' ? '・装備中' : '';
    this.text(px, py, `${meta.label}・${SLOT_META[base.slot].label}・iLv${item.itemLevel}${where}`, 6, '#94b0c2');
    py += 10;

    // 左：性能 / 右：付け替えたときの変化
    const colW = Math.floor((w - 8) / 2);
    let ly = py;
    for (const line of itemLines(item)) {
      this.text(px, ly, line.text, 6, line.color);
      ly += 8;
    }

    let ry = py;
    const rx = px + colW;
    if (sel.kind === 'bag' && !canEquip(item)) {
      this.text(rx, ry, 'このジョブでは', 6, '#b13e53');
      this.text(rx, ry + 8, '装備できない', 6, '#b13e53');
      ry += 16;
    } else {
      const before = currentStats();
      const after = sel.kind === 'bag' ? statsIfEquipped(item) : statsIfUnequipped(sel.slot);
      this.text(rx, ry, sel.kind === 'bag' ? '装備すると' : '外すと', 6, '#94b0c2');
      ry += 8;
      const diffs = diffStats(before, after);
      if (diffs.length === 0) {
        this.text(rx, ry, '変化なし', 6, '#94b0c2');
        ry += 8;
      }
      for (const d of diffs) {
        const up = d.delta > 0;
        this.text(rx, ry, `${STAT_META[d.key].label} ${formatStat(d.key, d.delta, true)}`, 6, up ? '#a7f070' : '#b13e53');
        ry += 8;
      }
    }

    // ---- ボタン
    const by = y + h - 16;
    const bw = Math.floor((w - 12) / 2);
    if (sel.kind === 'bag') {
      this.button(px, by, bw, 13, '装備する', 0x257179, canEquip(item), () => {
        const slot = itemSlot(item);
        if (equipFromInventory(item)) this.select({ kind: 'equip', slot });
      });
      const armed = this.sellArmed === item;
      const label = armed ? 'もう一度で売却' : `売る ${sellPrice(item)}G`;
      this.button(px + bw + 4, by, bw, 13, label, armed ? 0xb13e53 : 0x5d275d, true, () => {
        const needConfirm = item.rarity === 'rare' || item.rarity === 'legendary';
        if (needConfirm && this.sellArmed !== item) {
          this.sellArmed = item;
          this.refresh();
          return;
        }
        sellItem(item);
        this.selection = null;
        this.sellArmed = null;
        this.refresh();
      });
    } else {
      // 武装は外すと攻撃できなくなるので外せない
      const canRemove = sel.slot !== 'weapon' && !isInventoryFull();
      this.button(px, by, bw, 13, '外す', 0x566c86, canRemove, () => {
        if (unequip(sel.slot)) {
          this.selection = null;
          this.refresh();
        }
      });
    }
  }

  update() {
    // 辺ごとに色相をずらして、虹色が枠を回るように見せる
    const colors = [rainbowNow(0), rainbowNow(90), rainbowNow(180), rainbowNow(270)];
    for (const { g, x, y } of this.rainbowCells) {
      g.clear();
      drawFrame(g, x, y, 2, colors);
    }
  }

  private select(sel: Selection) {
    this.selection = sel;
    this.notice = null;
    this.sellArmed = null;
    this.refresh();
  }

  // ------------------------------------------------------------ 部品

  private text(x: number, y: number, str: string, size: number, color = '#f4f4f4') {
    const t = createText(this, x, y, str, size, color);
    this.root.add(t);
    return t;
  }

  /** アイテム1マス。空なら placeholderIcon を薄く表示 */
  private cell(
    x: number,
    y: number,
    item: ItemInstance | null,
    placeholderIcon: string | null,
    selected: boolean,
    onTap?: () => void,
  ) {
    const g = this.add.graphics();
    g.fillStyle(0x1a1c2c, 1).fillRect(x, y, CELL, CELL);
    const meta = item ? RARITY_META[item.rarity] : null;
    const rainbow = !!meta?.rainbow;
    if (!meta) {
      g.lineStyle(1, 0x333c57, 0.8).strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    } else {
      // レアリティが上がるほど枠が太く、銀・金は金属っぽい明暗を付ける
      if (item!.rarity !== 'normal') g.fillStyle(meta.tint, 0.15).fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      if (!rainbow) {
        const { width: fw, light, dark } = meta.frame;
        drawFrame(g, x, y, fw, [light, dark, dark, light]);
        if (fw > 1) g.fillStyle(0xffffff, 1).fillRect(x + fw, y + fw, 1, 1);
      }
    }
    if (selected) g.lineStyle(1, 0xffffff, 1).strokeRect(x - 0.5, y - 0.5, CELL + 1, CELL + 1);
    this.root.add(g);
    if (rainbow) {
      // 虹色の枠は毎フレーム描き直す（update）
      const rb = this.add.graphics();
      this.rainbowCells.push({ g: rb, x, y });
      this.root.add(rb);
    }

    const iconKey = item ? ITEM_BASES[item.baseId].icon : placeholderIcon;
    if (iconKey) {
      const img = this.add.image(x + CELL / 2, y + CELL / 2, iconKey, 0).setAlpha(item ? 1 : 0.2);
      if (item && !canEquip(item)) img.setAlpha(0.45);
      this.root.add(img);
    }
    if (onTap) {
      const z = this.add.zone(x, y, CELL, CELL).setOrigin(0).setInteractive();
      z.on('pointerup', () => this.time.delayedCall(0, onTap));
      this.root.add(z);
    }
  }

  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    enabled: boolean,
    onTap: () => void,
  ) {
    const g = this.add.graphics();
    g.fillStyle(color, enabled ? 1 : 0.3).fillRect(x, y, w, h);
    g.lineStyle(1, 0xf4f4f4, enabled ? 0.8 : 0.2).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.root.add(g);
    this.text(x + w / 2, y + h / 2, label, 6, enabled ? '#f4f4f4' : '#566c86').setOrigin(0.5);
    if (enabled) {
      const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
      z.on('pointerup', () => this.time.delayedCall(0, onTap));
      this.root.add(z);
    }
  }
}

/** マスの枠を描く。colors は [上, 右, 下, 左] */
function drawFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, colors: number[]) {
  const [top, right, bottom, left] = colors;
  g.fillStyle(top, 1).fillRect(x, y, CELL, w);
  g.fillStyle(left, 1).fillRect(x, y, w, CELL);
  g.fillStyle(bottom, 1).fillRect(x, y + CELL - w, CELL, w);
  g.fillStyle(right, 1).fillRect(x + CELL - w, y, w, CELL);
}

function diffStats(before: Stats, after: Stats): { key: StatKey; delta: number }[] {
  const out: { key: StatKey; delta: number }[] = [];
  for (const key of STAT_ORDER) {
    const delta = after[key] - before[key];
    if (Math.abs(delta) > 1e-6) out.push({ key, delta });
  }
  return out;
}

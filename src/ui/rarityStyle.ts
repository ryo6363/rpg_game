import Phaser from 'phaser';
import type { Rarity } from '../core/types';
import { RARITY_META } from '../data/itemMeta';

// レアリティ色の適用（虹色の処理をまとめる）

/** トースト等で「虹色で表示」を指定するための色名 */
export const RAINBOW = 'rainbow';

/** 色相（度）から虹色の1色を返す */
export function rainbowColor(hue: number): number {
  const c = Phaser.Display.Color.HSVToRGB((((hue % 360) + 360) % 360) / 360, 0.65, 1) as Phaser.Types.Display.ColorObject;
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/** 時間で変化する虹色（全画面で同じ周期にそろえる） */
export function rainbowNow(offset = 0): number {
  return rainbowColor(performance.now() * 0.3 + offset);
}

/** 文字に虹色のグラデーションを付ける */
export function setRainbowFill(text: Phaser.GameObjects.Text) {
  const w = Math.max(1, text.width);
  const grad = text.context.createLinearGradient(0, 0, w, 0);
  const stops = ['#ff6b6b', '#ffd23f', '#a7f070', '#41a6f6', '#c58cff', '#ff6bb5'];
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  text.setFill(grad);
}

/** 色名（'rainbow' を含む）を文字に適用する */
export function applyColor(text: Phaser.GameObjects.Text, color: string) {
  if (color === RAINBOW) setRainbowFill(text);
  else text.setColor(color);
}

/** レアリティの文字色（虹なら 'rainbow'） */
export function rarityTextColor(rarity: Rarity): string {
  const meta = RARITY_META[rarity];
  return meta.rainbow ? RAINBOW : meta.color;
}

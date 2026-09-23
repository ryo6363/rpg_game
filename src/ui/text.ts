import Phaser from 'phaser';
import { DISPLAY } from '../config/balance';
import { viewport } from '../core/Viewport';

/** 行頭に来てはいけない文字（句読点・閉じかっこ） */
const NO_LINE_START = '、。，．」』）！？ー…・ぁぃぅぇぉっゃゅょァィゥェォッャュョ';

/**
 * 日本語の折り返し。Phaser の wordWrap は空白でしか折り返さないため自前で行う。
 * 全角は fontSize、半角は fontSize/2 の幅として数える。
 */
export function wrapJa(text: string, maxWidth: number, fontSize: number): string {
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const ch of text) {
    const w = ch.charCodeAt(0) < 0x7f ? fontSize / 2 : fontSize;
    if (width + w > maxWidth && line.length > 0) {
      // 句読点は前の行にぶら下げる
      if (NO_LINE_START.includes(ch)) {
        line += ch;
        lines.push(line);
        line = '';
        width = 0;
        continue;
      }
      lines.push(line);
      line = '';
      width = 0;
    }
    line += ch;
    width += w;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * 論理px単位で指定するテキスト。カメラの整数ズームに合わせて
 * 高解像度でラスタライズするので、拡大してもぼやけない。
 */
export function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 8,
  color = '#f4f4f4',
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: DISPLAY.fontFamily,
    fontSize: `${size}px`,
    color,
    resolution: viewport.zoom,
    ...extra,
  });
}

import Phaser from 'phaser';
import { DISPLAY } from '../config/balance';
import { viewport } from '../core/Viewport';

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

import Phaser from 'phaser';
import { buildAllTextures, createAnimations } from '../core/TextureFactory';
import { SaveManager } from '../core/SaveManager';

/** テクスチャ生成・フォント読み込み */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildAllTextures(this);
    createAnimations(this);
    SaveManager.load();

    // ドットフォントの読み込みを待つ（オフライン等で失敗しても先へ進む）
    const fontReady = document.fonts
      ? Promise.race([
          document.fonts.load('16px "DotGothic16"'),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ])
      : Promise.resolve();
    fontReady.catch(() => undefined).then(() => this.scene.start('Title'));
  }
}

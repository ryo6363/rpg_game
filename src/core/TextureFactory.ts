import Phaser from 'phaser';
import { CHARACTER_SPRITES, EFFECT_SPRITES, ICON_SPRITES, PALETTE, TILE_PIXELS, type PixelFrame, type PixelSprite } from '../data/sprites';
import { TILE_TYPES } from '../data/tiles';
import { DISPLAY } from '../config/balance';

// data/sprites.ts のピクセル定義からテクスチャを生成する

const rgbCache = new Map<string, [number, number, number]>();
function rgb(ch: string): [number, number, number] | null {
  const hex = PALETTE[ch];
  if (!hex) return null;
  let c = rgbCache.get(ch);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(ch, c);
  }
  return c;
}

function drawFrame(img: ImageData, ox: number, w: number, h: number, frame: PixelFrame, name: string) {
  for (let y = 0; y < h; y++) {
    if (Array.isArray(frame) && frame[y] !== undefined && frame[y].length !== w && import.meta.env.DEV) {
      console.warn(`[sprites] ${name} row ${y} has length ${frame[y].length}, expected ${w}`);
    }
    for (let x = 0; x < w; x++) {
      const ch = Array.isArray(frame) ? (frame[y]?.[x] ?? '.') : frame(x, y);
      const c = rgb(ch);
      if (!c) continue;
      const i = (y * img.width + ox + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
}

function buildStrip(scene: Phaser.Scene, key: string, w: number, h: number, frames: PixelFrame[]) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * frames.length, h)!;
  const ctx = tex.getContext();
  const img = ctx.createImageData(w * frames.length, h);
  frames.forEach((f, i) => drawFrame(img, i * w, w, h, f, key));
  ctx.putImageData(img, 0, 0);
  frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
  tex.refresh();
}

function buildSprite(scene: Phaser.Scene, s: PixelSprite) {
  buildStrip(scene, s.key, s.width, s.height, s.frames);
}

export function buildAllTextures(scene: Phaser.Scene) {
  for (const s of [...CHARACTER_SPRITES, ...EFFECT_SPRITES, ...ICON_SPRITES]) buildSprite(scene, s);

  const ts = DISPLAY.tileSize;
  buildStrip(
    scene,
    'tiles',
    ts,
    ts,
    TILE_TYPES.map((t) => TILE_PIXELS[t.name]),
  );
}

export function createAnimations(scene: Phaser.Scene) {
  for (const s of [...CHARACTER_SPRITES, ...EFFECT_SPRITES]) {
    for (const a of s.anims ?? []) {
      const key = `${s.key}_${a.name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: a.frames.map((f) => ({ key: s.key, frame: f })),
        frameRate: a.frameRate,
        repeat: -1,
      });
    }
  }
}

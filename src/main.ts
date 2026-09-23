import Phaser from 'phaser';
import { EventBus, GameEvents } from './core/EventBus';
import { gameState } from './core/GameState';
import { HudState } from './core/HudState';
import { InputState } from './input/InputState';
import { createItem } from './systems/Items';
import { updateViewport, viewport } from './core/Viewport';
import { BootScene } from './scenes/BootScene';
import { FieldScene } from './scenes/FieldScene';
import { FlashbackScene } from './scenes/FlashbackScene';
import { ChapterClearScene } from './scenes/ChapterClearScene';
import { DebugScene } from './scenes/DebugScene';
import { DialogScene } from './scenes/DialogScene';
import { InventoryScene } from './scenes/InventoryScene';
import { JobSelectScene } from './scenes/JobSelectScene';
import { TownScene } from './scenes/TownScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { Sfx } from './ui/sfx';

// ---- iOS Safari のズーム・スクロール・長押しメニューを抑止
const prevent = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', prevent, { passive: false });
document.addEventListener('gesturechange', prevent, { passive: false });
document.addEventListener('gestureend', prevent, { passive: false });
document.addEventListener('dblclick', prevent, { passive: false });
document.addEventListener('contextmenu', prevent);
document.addEventListener('selectstart', prevent);
document.addEventListener('touchmove', prevent, { passive: false });
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = performance.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

// ---- 効果音：iOS は最初のタップの中で音声を有効にする必要がある
const unlockAudio = () => Sfx.unlock();
document.addEventListener('touchend', unlockAudio, { passive: true });
document.addEventListener('pointerdown', unlockAudio, { passive: true });

// ---- ゲーム本体
// キャンバスは実機ピクセル解像度。各シーンのカメラを viewport.zoom 倍（整数）にして描画する
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: viewport.deviceW,
  height: viewport.deviceH,
  backgroundColor: '#1a1c2c',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: 1 / viewport.dpr,
  },
  input: { activePointers: 4 },
  physics: { default: 'arcade', arcade: { debug: false } },
  fps: { target: 60 },
  render: { powerPreference: 'high-performance', antialias: false },
  scene: [
    BootScene,
    TitleScene,
    TownScene,
    FieldScene,
    UIScene,
    InventoryScene,
    JobSelectScene,
    DialogScene,
    ChapterClearScene,
    DebugScene,
    FlashbackScene,
  ],
});

// ---- 画面サイズ変更（回転・アドレスバー表示切替など）
let resizeTimer = 0;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const prev = viewport;
    const vp = updateViewport();
    if (prev.deviceW === vp.deviceW && prev.deviceH === vp.deviceH && prev.zoom === vp.zoom) return;
    game.scale.setZoom(1 / vp.dpr);
    game.scale.resize(vp.deviceW, vp.deviceH);
    EventBus.emit(GameEvents.ViewportChanged, vp);
  }, 150);
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
window.visualViewport?.addEventListener('resize', onResize);

// 開発時のみ：コンソールからの動作確認用
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, {
    __game: game,
    __debug: { gameState, EventBus, GameEvents, InputState, HudState, createItem },
  });
}

// 読み込み成功の印（index.html の読み込みエラー表示が使う）
(window as unknown as { __gameStarted: boolean }).__gameStarted = true;

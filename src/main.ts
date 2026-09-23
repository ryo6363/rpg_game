import Phaser from 'phaser';
import { EventBus, GameEvents } from './core/EventBus';
import { updateViewport, viewport } from './core/Viewport';
import { BootScene } from './scenes/BootScene';
import { FieldScene } from './scenes/FieldScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';

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
  scene: [BootScene, TitleScene, FieldScene, UIScene],
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
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

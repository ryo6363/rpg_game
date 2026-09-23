import { DISPLAY } from '../config/balance';

// 画面サイズ・整数倍率・セーフエリアの計算。
// キャンバスは実機ピクセル解像度で描き、各シーンのカメラを整数倍ズームすることで
// ドット絵はくっきり、文字は高解像度で表示する。

export interface Viewport {
  dpr: number;
  /** 論理px → 実機px の整数倍率 */
  zoom: number;
  deviceW: number;
  deviceH: number;
  /** 論理解像度 */
  width: number;
  height: number;
  /** セーフエリア（論理px） */
  safe: { top: number; right: number; bottom: number; left: number };
}

export function computeViewport(): Viewport {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const deviceW = Math.round(cssW * dpr);
  const deviceH = Math.round(cssH * dpr);
  const zoom = Math.max(1, Math.floor(deviceW / DISPLAY.baseWidth));

  const probe = document.getElementById('safe-probe');
  const cs = probe ? getComputedStyle(probe) : null;
  const toLogical = (v: string | undefined) => ((parseFloat(v ?? '0') || 0) * dpr) / zoom;

  return {
    dpr,
    zoom,
    deviceW,
    deviceH,
    width: deviceW / zoom,
    height: deviceH / zoom,
    safe: {
      top: toLogical(cs?.paddingTop),
      right: toLogical(cs?.paddingRight),
      bottom: toLogical(cs?.paddingBottom),
      left: toLogical(cs?.paddingLeft),
    },
  };
}

/** 現在のビューポート（main.ts がリサイズ時に更新する） */
export let viewport: Viewport = computeViewport();

export function updateViewport(): Viewport {
  viewport = computeViewport();
  return viewport;
}

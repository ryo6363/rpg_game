import type Phaser from 'phaser';
import { InputState } from '../input/InputState';

// 持ち物・ジョブ選択などの全画面メニューの開閉。
// 開いている間はフィールド／町を一時停止し、操作 UI を隠す。

/** 今動いているフィールド／町のシーンキー（各シーンが create で登録する） */
export const WORLD_SCENE_KEY = 'worldScene';

export function openOverlay(from: Phaser.Scene, key: string, data?: object) {
  InputState.reset();
  const world = from.registry.get(WORLD_SCENE_KEY) as string | undefined;
  if (world) from.scene.pause(world);
  from.scene.launch(key, data);
  from.scene.bringToTop(key);
  if (from.scene.isActive('UI')) from.scene.sleep('UI');
}

export function closeOverlay(overlay: Phaser.Scene) {
  const world = overlay.registry.get(WORLD_SCENE_KEY) as string | undefined;
  overlay.scene.stop();
  if (world) overlay.scene.resume(world);
  overlay.scene.wake('UI');
}

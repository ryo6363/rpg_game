import Phaser from 'phaser';
import { DISPLAY } from '../config/balance';
import type { AreaDef, ExitDef } from '../core/types';
import { MAPS } from '../data/maps';
import { MAP_MARKERS, TILE_TYPES } from '../data/tiles';

// data/maps.ts の文字列マップからタイルマップを作る（町・フィールド共通）

export interface BuiltMap {
  layer: Phaser.Tilemaps.TilemapLayer;
  width: number;
  height: number;
  /** 歩けるタイルの中心座標（敵の出現位置に使う） */
  walkable: { x: number; y: number }[];
  /** 目印の文字 → そのタイルの中心座標 */
  markers: Map<string, { x: number; y: number }[]>;
  /** その座標が出入口なら ExitDef */
  exitAt(x: number, y: number): ExitDef | null;
  /** その座標が壁（通れないタイル）か */
  isWall(x: number, y: number): boolean;
  /** その座標が浅瀬（移動が遅くなるタイル）か */
  isSlow(x: number, y: number): boolean;
  /** 出入口のタイルの中心座標（時間の裂け目の演出用） */
  exitTiles: { x: number; y: number }[];
  /** その座標のタイルの文字 */
  charAt(x: number, y: number): string | undefined;
}

export function buildAreaMap(scene: Phaser.Scene, area: AreaDef): BuiltMap {
  const padX = DISPLAY.mapPadX;
  const padY = DISPLAY.mapPadY;
  const ts = DISPLAY.tileSize;
  const src = MAPS[area.map];
  const wall = area.border ?? MAP_MARKERS.border;
  const fullW = src[0].length + padX * 2;
  const rows = [
    ...Array.from({ length: padY }, () => wall.repeat(fullW)),
    ...src.map((r) => wall.repeat(padX) + r + wall.repeat(padX)),
    ...Array.from({ length: padY }, () => wall.repeat(fullW)),
  ];

  const charToIndex = new Map(TILE_TYPES.map((t, i) => [t.char, i]));
  if (import.meta.env.DEV) {
    // 目印の文字がタイルの文字と重なると、目印ではなくタイルとして描かれてしまう
    const markerChars = [
      ...(area.npcs ?? []).map((n) => n.marker),
      ...(area.objects ?? []).map((o) => o.marker),
      ...(area.boss ? [area.boss.marker] : []),
    ];
    for (const ch of markerChars) {
      if (charToIndex.has(ch)) console.warn(`[map] ${area.id}: 目印の文字 '${ch}' はタイルの文字と重なっています`);
    }
  }
  const floorIndex = charToIndex.get(area.floor) ?? 0;
  const gateIndex = charToIndex.get('#')!;
  const exitChars = new Map(area.exits.map((e) => [e.char, e]));
  const markers = new Map<string, { x: number; y: number }[]>();
  const exitGrid: (ExitDef | null)[][] = [];

  const data = rows.map((row, ty) => {
    exitGrid[ty] = [];
    return [...row].map((ch, tx) => {
      exitGrid[ty][tx] = exitChars.get(ch) ?? null;
      if (exitChars.has(ch)) return gateIndex;
      const idx = charToIndex.get(ch);
      if (idx !== undefined) return idx;
      // タイル以外の文字は目印（床タイルで描く）
      const list = markers.get(ch) ?? [];
      list.push({ x: tx * ts + ts / 2, y: ty * ts + ts / 2 });
      markers.set(ch, list);
      return floorIndex;
    });
  });

  const exitTiles: { x: number; y: number }[] = [];
  exitGrid.forEach((row, ty) => row.forEach((ex, tx) => ex && exitTiles.push({ x: tx * ts + ts / 2, y: ty * ts + ts / 2 })));
  const walkable: { x: number; y: number }[] = [];
  data.forEach((row, ty) =>
    row.forEach((idx, tx) => {
      if (!TILE_TYPES[idx].collide && !exitGrid[ty][tx]) walkable.push({ x: tx * ts + ts / 2, y: ty * ts + ts / 2 });
    }),
  );

  const map = scene.make.tilemap({ data, tileWidth: ts, tileHeight: ts });
  const tileset = map.addTilesetImage('tiles', 'tiles', ts, ts, 0, 0)!;
  const layer = map.createLayer(0, tileset, 0, 0)!;
  layer.setCollision(TILE_TYPES.flatMap((t, i) => (t.collide ? [i] : [])));
  layer.setDepth(-10000);
  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  return {
    layer,
    width: map.widthInPixels,
    height: map.heightInPixels,
    walkable,
    markers,
    exitAt: (x, y) => exitGrid[Math.floor(y / ts)]?.[Math.floor(x / ts)] ?? null,
    isWall: (x, y) => {
      const idx = data[Math.floor(y / ts)]?.[Math.floor(x / ts)];
      return idx === undefined || TILE_TYPES[idx].collide;
    },
    exitTiles,
    charAt: (x, y) => rows[Math.floor(y / ts)]?.[Math.floor(x / ts)],
    isSlow: (x, y) => {
      const idx = data[Math.floor(y / ts)]?.[Math.floor(x / ts)];
      return idx !== undefined && !!TILE_TYPES[idx].slow;
    },
  };
}

// マップ文字とタイルの対応。並び順がタイルセット画像内のインデックスになる。
// 見た目は data/sprites.ts の TILE_PIXELS[name]

export interface TileType {
  char: string;
  name: string;
  collide: boolean;
}

export const TILE_TYPES: TileType[] = [
  { char: '.', name: 'grass', collide: false },
  { char: ',', name: 'grass2', collide: false },
  { char: '*', name: 'flowers', collide: false },
  { char: '=', name: 'path', collide: false },
  { char: 'T', name: 'tree', collide: true },
  { char: 'o', name: 'rock', collide: true },
  { char: '~', name: 'water', collide: true },
];

/** マップ上で特別な意味を持つ文字（タイルとしては草で描画） */
export const MAP_MARKERS = {
  playerStart: '@',
  /** マップ外周の余白に使うタイル */
  border: 'T',
} as const;

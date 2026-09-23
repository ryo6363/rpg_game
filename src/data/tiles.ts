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
  // 町
  { char: ':', name: 'stone', collide: false },
  { char: 'R', name: 'roof', collide: true },
  { char: 'H', name: 'wall', collide: true },
  { char: 'D', name: 'door', collide: true },
  { char: 'F', name: 'fence', collide: true },
  // 灰の都・廃高速道路
  { char: ';', name: 'ash_stone', collide: false },
  { char: 'K', name: 'ash_wall', collide: true },
  { char: 'U', name: 'ash_roof', collide: true },
  { char: 'A', name: 'asphalt', collide: false },
  { char: 'L', name: 'lane', collide: false },
  { char: 'I', name: 'guardrail', collide: true },
  { char: 'X', name: 'debris', collide: true },
  /** 出入口。エリア定義の exits の文字もこのタイルで描く */
  { char: '#', name: 'gate', collide: false },
];

/** マップ上で特別な意味を持つ文字 */
export const MAP_MARKERS = {
  /** 既定の出現位置（エリアの床タイルで描く） */
  playerStart: '@',
  /** マップ外周の余白に使うタイル */
  border: 'T',
} as const;

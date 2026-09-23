// ドット絵の定義はすべてこのファイルに集約する。
// 本物の画像に差し替えるときは、ここで定義しているキー名と同じキーで
// BootScene で画像を読み込めば、他のコードは変更不要。
//
// 書式: 1文字 = 1ピクセル。'.' は透明。文字と色の対応は PALETTE。
// 手描きの文字列配列のほか、(x, y) => 文字 の関数でも定義できる（タイルの模様など）。

export const PALETTE: Record<string, string> = {
  k: '#1a1c2c', // 輪郭
  w: '#f4f4f4',
  s: '#94b0c2',
  m: '#566c86',
  d: '#333c57',
  r: '#b13e53',
  o: '#ef7d57',
  y: '#ffcd75',
  l: '#a7f070',
  g: '#38b764',
  t: '#257179',
  n: '#29366f',
  b: '#3b5dc9',
  c: '#41a6f6',
  a: '#73eff7',
  p: '#5d275d',
  f: '#f2c7a0', // 肌
  u: '#8b5a3c', // 茶
  G: '#3f8a4b', // 草
  H: '#5aa35a', // 草・明
  J: '#2f6b3c', // 草・暗
  P: '#c9a66b', // 土
  Q: '#a8844f', // 土・暗
};

export type PixelGen = (x: number, y: number) => string;
export type PixelFrame = string[] | PixelGen;

export interface PixelSprite {
  key: string;
  width: number;
  height: number;
  frames: PixelFrame[];
  /** アニメーション。キーは "<key>_<name>" で登録される */
  anims?: { name: string; frames: number[]; frameRate: number }[];
}

/** 座標から決まる疑似乱数 0〜99（模様用） */
const noise = (x: number, y: number, seed: number) =>
  (((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0) % 100;

// ---------------------------------------------------------------- キャラクター

const WARRIOR_BODY = [
  '................',
  '......kkkk......',
  '.....ksssskk....',
  '....ksswsssk....',
  '....kssssssk....',
  '....kffkfffk....',
  '....kfffffk.....',
  '...kbbkkkbbk....',
  '..kbbbbbbbbbk...',
  '..kfkbbybbkfk...',
  '..kkkbbbbbkkk...',
  '....kbbbbbk.....',
  '....kmmkmmk.....',
];

export const CHARACTER_SPRITES: PixelSprite[] = [
  {
    key: 'warrior',
    width: 16,
    height: 16,
    anims: [{ name: 'walk', frames: [0, 1], frameRate: 7 }],
    frames: [
      [...WARRIOR_BODY, '....kuk.kuk.....', '....kuk.kuuk....', '....kk...kk.....'],
      [...WARRIOR_BODY, '...kuk...kuk....', '...kuuk..kk.....', '....kk..........'],
    ],
  },
  {
    key: 'slime',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [
      [
        '................',
        '................',
        '................',
        '................',
        '................',
        '......kkkk......',
        '....kkggggkk....',
        '...kglggggggk...',
        '..kglwgggggggk..',
        '..kggggkggkggk..',
        '.kgggggkggkgggk.',
        '.kggggggggggggk.',
        '.ktggggggggggtk.',
        '..kttttttttttk..',
        '...kkkkkkkkkk...',
        '................',
      ],
      [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '.......kkkk.....',
        '....kkkggggkk...',
        '..kkglgggggggkk.',
        '.kglwggkggkgggk.',
        '.kgggggkggkgggk.',
        'kggggggggggggggk',
        'ktggggggggggggtk',
        '.kttttttttttttk.',
        '..kkkkkkkkkkkk..',
        '................',
      ],
    ],
  },
];

// ---------------------------------------------------------------- エフェクト

export const EFFECT_SPRITES: PixelSprite[] = [
  {
    // 剣の斬撃（右向き）。回転させて使う
    key: 'fx_slash',
    width: 24,
    height: 24,
    frames: [0, 1, 2].map((f): PixelGen => (x, y) => {
      const dx = x - 11.5;
      const dy = y - 11.5;
      const r = Math.hypot(dx, dy);
      const ang = Math.abs(Math.atan2(dy, dx)) * (180 / Math.PI);
      const maxAng = 50 + f * 20;
      if (ang > maxAng) return '.';
      if (r >= 9.5 && r < 11.5) return f === 2 ? 's' : 'w';
      if (r >= 7.5 && r < 9.5) return f === 2 ? '.' : 'a';
      return '.';
    }),
  },
  {
    key: 'fx_spark',
    width: 2,
    height: 2,
    frames: [['ww', 'ww']],
  },
  {
    key: 'shadow',
    width: 10,
    height: 4,
    frames: [['..kkkkkk..', '.kkkkkkkk.', '.kkkkkkkk.', '..kkkkkk..']],
  },
];

// ---------------------------------------------------------------- タイル（16x16）
// data/tiles.ts のタイル名と対応させる

const grassGen = (seed: number): PixelGen => (x, y) => {
  const n = noise(x, y, seed);
  if (n < 6) return 'H';
  if (n < 10) return 'J';
  return 'G';
};

const FLOWER_POINTS: Record<string, string> = {
  '3,4': 'y', '2,4': 'w', '4,4': 'w', '3,3': 'w', '3,5': 'w',
  '11,10': 'r', '10,10': 'o', '12,10': 'o', '11,9': 'o', '11,11': 'o',
  '6,12': 'w', '7,13': 'w',
};

export const TILE_PIXELS: Record<string, PixelFrame> = {
  grass: grassGen(1),
  grass2: grassGen(7),
  flowers: (x, y) => FLOWER_POINTS[`${x},${y}`] ?? grassGen(3)(x, y),
  path: (x, y) => {
    const n = noise(x, y, 11);
    if (n < 12) return 'Q';
    if (n < 16) return 'y';
    return 'P';
  },
  tree: [
    'GGGGGkkkkkkGGGGG',
    'GGGkkJgggJJkkGGG',
    'GGkJgglggJJJJkGG',
    'GkJgglllggJJJJkG',
    'GkJggllgggJJJJkG',
    'kJJgggggJJJJJJJk',
    'kJJJgggJJJgggJJk',
    'kJJJJJJJJgglgJJk',
    'kJJgggJJJgggJJJk',
    'GkJJJJJJJJJJJJkG',
    'GkkJJJJJJJJJJkkG',
    'GGGkkkkuukkkkGGG',
    'GGGGGGkuukGGGGGG',
    'GGGGGGkuukGGGGGG',
    'GGGGGkuuuukGGGGG',
    'GGGGGJJJJJJGGGGG',
  ],
  rock: [
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGkkkkkGGGGGG',
    'GGGkkssssmkkGGGG',
    'GGksswsssmmmkGGG',
    'GkssswssmmmmmkGG',
    'GksssssmmmmmmkGG',
    'kssssmmmmmmdmmkG',
    'ksssmmmmmmdddmkG',
    'kmmmmmmmmdddddkG',
    'GkmmmmmddddddkGG',
    'GGkkddddddkkkGGG',
    'GGGJkkkkkkJJGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  water: (x, y) => {
    const wave = (x + Math.floor(y / 4) * 5) % 8;
    if (y % 4 === 1 && wave < 3) return 'a';
    if (noise(x, y, 5) < 8) return 'c';
    return 'b';
  },
};

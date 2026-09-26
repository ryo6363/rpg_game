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
  v: '#c58cff', // 薄紫（魔法）
  V: '#9a8f7e', // 石畳
  Y: '#7a6f60', // 石畳・暗
  E: '#e4d4b4', // しっくい
  B: '#6b4a2e', // 木の梁
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

// 主人公：オープンカーに乗った人（右向き）。X = 車体色、Z = 車体の影色
const CAR_BODY = [
  '................',
  '................',
  '.....kkkk.......',
  '....kuuuuk......',
  '....kuffkfk.....',
  '....kfffffk.....',
  '.....kwwwk.ka...',
  '..kkkkwwwkkka...',
  '.kXXXXXXXXXXXXk.',
  'kXXXXXXXXXXXXXyk',
  'kZXXXXXXXXXXXXXk',
  'kZZZZZZZZZZZZZZk',
];
// 車輪は2コマで回転しているように見せる
const CAR_WHEELS_A = ['..kmmsk...kmmsk.', '..kmssk...kmssk.', '...kkk.....kkk..', '................'];
const CAR_WHEELS_B = ['..ksmmk...ksmmk.', '..kmmsk...kmmsk.', '...kkk.....kkk..', '................'];

/** 車体色を差し替えた主人公スプライトを作る（ジョブごとに色違い） */
const carSprite = (key: string, body: string, shade: string): PixelSprite => {
  const paint = (rows: string[]) => rows.map((r) => r.replace(/X/g, body).replace(/Z/g, shade));
  return {
    key,
    width: 16,
    height: 16,
    anims: [{ name: 'move', frames: [0, 1], frameRate: 10 }],
    frames: [paint([...CAR_BODY, ...CAR_WHEELS_A]), paint([...CAR_BODY, ...CAR_WHEELS_B])],
  };
};

// 町の人（正面向き）。H = 髪、C = 服、D = ズボン
const PERSON = [
  '................',
  '.....kkkkkk.....',
  '....kHHHHHHk....',
  '....kHffffHk....',
  '....kfkffkfk....',
  '....kffffffk....',
  '.....kffffk.....',
  '....kCCCCCCk....',
  '...kCCCCCCCCk...',
  '...kfCCCCCCfk...',
  '...kkCCCCCCkk...',
  '....kDDDDDDk....',
  '....kDDkkDDk....',
  '....kDk..kDk....',
  '....kkk..kkk....',
  '................',
];
const personSprite = (key: string, hair: string, cloth: string, pants: string): PixelSprite => ({
  key,
  width: 16,
  height: 16,
  frames: [PERSON.map((r) => r.replace(/H/g, hair).replace(/C/g, cloth).replace(/D/g, pants))],
});

/** 3コマで揺らめく炎（core = 芯、mid = 中、outer = 外側の色） */
function flameSprite(key: string, core: string, mid: string, outer: string): PixelSprite {
  return {
    key,
    width: 8,
    height: 10,
    anims: [{ name: 'burn', frames: [0, 1, 2], frameRate: 12 }],
    frames: [0, 1, 2].map((f): PixelGen => (x, y) => {
      // しずく形：下が丸く、上がとがる。コマごとに先端が左右に揺れる
      const sway = [0, 1, -1][f];
      const cx = 3.5 + (sway * (9 - y)) / 9;
      const halfW = y >= 6 ? 3.2 - (y - 6) * 0.35 : 0.5 + y * 0.45;
      const d = Math.abs(x - cx);
      if (d > halfW) return '.';
      if (d < halfW * 0.35 && y > 3) return core;
      if (d < halfW * 0.7) return mid;
      return outer;
    }),
  };
}

/** 行の長さを幅にそろえる（手描きの数え間違い対策） */
const fit = (rows: string[], w: number) => rows.map((r) => r.padEnd(w, '.').slice(0, w));

// ---- 第1章の敵
const WOLF_TOP = [
  '................',
  '................',
  '................',
  '..........k..k..',
  '.........kmkkmk.',
  '.........kmmmmsk',
  'k.......kmmrmmmk',
  'mk..kkkkmmmmmskk',
  '.mkkmmmmmmmmmk..',
  '..kmmmmmmmmmmk..',
  '..kdmmmmmmmmdk..',
  '..kddkkkkkkddk..',
];
const GOBLIN_TOP = [
  '................',
  '......kkk.......',
  '.....kgggk......',
  '....kgkggk......',
  '....kggggkk.....',
  '.....krrk.ks....',
  '....krrrrkss....',
  '...kuukrrkuuk...',
  '..kuuuuuuuuuuk..',
  '.kuuuuuuuuuuuwk.',
  '.kQuuuuuuuuuukk.',
  '..kuuuuuuuuuk...',
];
const FLOWER_BOTTOM = [
  '..kvvpkyykpvvk..',
  '..kvpkyyyykpvk..',
  '...kpkyyyykpk...',
  '....kkpppkk.....',
  '......kgk.......',
  '...kk.kgk.kk....',
  '..kgggkgkgggk...',
  '...kkgggggkk....',
  '.....kgggk......',
  '....kkkkkkk.....',
  '................',
];
const TREANT_TOP = [
  '....kkkkkkk.....',
  '..kkJgggJJJkk...',
  '.kJggglgJJJJJk..',
  'kJgglllggJJJJJk.',
  'kJJgggggJJJJJJk.',
  '.kJJJJJJJJJJJk..',
  '..kkkuuuuukkk...',
  '....kuykuyk.....',
  '....kuuuuuk.....',
  '...kuukkkuuk....',
  '..kuukuuuukuuk..',
  '.kuk.kuuuuk.kuk.',
  '.kk..kuuuuk..kk.',
  '....kuukkuuk....',
];

// ---- 第1章ボス「森喰らいのヴァルグ」（32x24、右向き）
const VARG_TOP = [
  '................................',
  '......................w.....w...',
  '.....................ws....ws...',
  '.....................sw...sw....',
  '......................sk.sk.....',
  '.....................kddkddk....',
  '....................kddddddk....',
  '...................kddnddadk....',
  '..................kdddddddddkk..',
  '..k..............kddddddddddwwk.',
  '.kdk...kkkkkkkkkkddddddddddkkwk.',
  '.kdnkkkdddddddddddddddddddkaak..',
  '..kdnddddddnddddnddddddddk.ac...',
  '...kddddddddddddddddddddk..a....',
  '...kdnddddddddddddddddddk.......',
  '....kddddddddddddddddddk........',
  '....kddnddddddddddnddddk........',
  '....kddkkkddddddddkkdddk........',
];

// ---- 第2章の敵・物
const ARMOR_GOBLIN_TOP = [
  '................',
  '.....kkkkk......',
  '....ksswssk.....',
  '....kssssssk....',
  '....kdkgkgdk....',
  '....kgggggk.....',
  '...kkkssskkk.k..',
  '..ksssmmmsssksk.',
  '..ksmsmmmsmskw..',
  '..kgksmmmskgk...',
  '...kksssssk.....',
  '....kmmkmmk.....',
];
const GOLEM = [
  '................',
  '....kkkkkkk.....',
  '...kVVVVVVVk....',
  '..kVVyVVVyVVk...',
  '..kVVVVVVVVVk...',
  '.kkYVVkkkVVYkk..',
  'kVVkYVVVVVYkVVk.',
  'kVVVkVVVVVkVVVk.',
  'kYVVkVVaVVkVVYk.',
  '.kkkkVVVVVkkkk..',
  '....kVVVVVk.....',
  '...kVVYkYVVk....',
  '...kVVk.kVVk....',
  '..kYVVk.kVVYk...',
  '..kkkkk.kkkkk...',
  '................',
];
const SHADOW_TOP = [
  '................',
  '................',
  '......kkkk......',
  '.....kpppnk.....',
  '....kppppppk....',
  '....kpwppwpk....',
  '....kppppppk....',
  '...kpnppppnpk...',
  '...kppppppppk...',
  '..kpnpppppnppk..',
  '..kpppppppppk...',
  '..kppppppppppk..',
];
const MAGE_SOLDIER = [
  '................',
  '......kkk.......',
  '.....kpppk..k...',
  '....kppppk.kyk..',
  '....kpfkfk..k...',
  '....kpfffk..u...',
  '...kpppppkk.u...',
  '..kppvvvppkuu...',
  '..kpvvvvvppk.u..',
  '..kppvvvpppk.u..',
  '..kpppppppk..u..',
  '...kppppppk..u..',
  '...kpppppppk.u..',
  '..kppppppppk....',
  '..kkkkkkkkkk....',
  '................',
];
// 誰も乗っていない車（車体・影・ライトの色を差し替えて使う）
const EMPTY_CAR_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....kdddk.ka...',
  '..kkkkdddkkka...',
  '.kXXXXXXXXXXXXk.',
  'kXXXXXXXXXXXXXLk',
  'kZXXXXXXXXXXXXXk',
  'kZZZZZZZZZZZZZZk',
  '..kmmsk...kmmsk.',
  '..kmssk...kmssk.',
  '...kkk.....kkk..',
  '................',
];
const EMPTY_CAR_B = EMPTY_CAR_A.map((r, i) => (i === 12 ? '..ksmmk...ksmmk.' : i === 13 ? '..kmmsk...kmmsk.' : r));
const recolorCar = (rows: string[], body: string, shade: string, light: string) =>
  rows.map((r) => r.replace(/X/g, body).replace(/Z/g, shade).replace(/L/g, light));

// 時計の数字（5x7）
const DIGIT_5 = ['kkkkk', 'k....', 'kkkk.', '....k', '....k', 'k...k', '.kkk.'];
const DIGIT_4 = ['...k.', '..kk.', '.k.k.', 'k..k.', 'kkkkk', '...k.', '...k.'];
/** 塔の上の大きな時計。文字盤の中央に数字を描く */
const clockFrame = (digit: string[]): PixelGen => (x, y) => {
  const cx = 15.5;
  const cy = 13.5;
  const r = Math.hypot(x - cx, y - cy);
  if (y < 28) {
    if (r > 13.5) return '.';
    if (r > 12.5) return 'k';
    if (r > 10.5) return 'y';
    // 数字
    const dx = x - 13;
    const dy = y - 10;
    if (dx >= 0 && dx < 5 && dy >= 0 && dy < 7) return digit[dy][dx] === 'k' ? 'k' : 'w';
    // 12・3・6・9 の目盛り
    if ((Math.abs(x - cx) < 1 && r > 8.5) || (Math.abs(y - cy) < 1 && r > 8.5)) return 'd';
    return 'w';
  }
  // 塔の柱
  if (x < 11 || x > 20) return '.';
  if (x === 11 || x === 20 || y === 39) return 'k';
  return (y + x) % 6 === 0 ? 'd' : 'm';
};

// 第2章ボス
const GRADION = [
  '................................',
  '................................',
  '..........................kk....',
  '.........................kwsk...',
  '.............kkkkk......kwsk....',
  '............ksssssk....kwsk.....',
  '...kkkk....kswssssk...kwsk......',
  '..kmmmmk...kssssssk..kwsk.......',
  '.kmkmmkmk..kdkkkkdk.kwsk........',
  '.kmmkkmmk..ksrrrrsk.kwk.........',
  '.kmkmmkmk..kssssssk.kk..........',
  '..kmmmmk.kkkkssssskkkyyk........',
  '...kkkk.krrsssssssssskyk........',
  '......kkrrsssmmmmmssskk.........',
  '.....kbbkrssmmwwmmssk...........',
  '....kbbbbkrsmmwwmmssk...........',
  '....kbwbbkrssmmmmmssk...........',
  '....kbbwbkrrsssssssrk...........',
  '....kbbbbkrrsdddddsrk...........',
  '.....kbbkrrrsdddddsrk...........',
  '......kkkrrrsssssssrk...........',
  '........krrrkssk.sskk...........',
  '........krrrkssk.ssk............',
  '........krrrkddk.ddk............',
  '.........krrkddk.ddk............',
  '..........kkkddk.ddk............',
  '............kssk.ssk............',
  '...........kssssksssk...........',
  '...........kkkkkkkkkk...........',
  '................................',
  '................................',
  '................................',
];

export const CHARACTER_SPRITES: PixelSprite[] = [
  {
    key: 'wolf',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 6 }],
    frames: [
      fit([...WOLF_TOP, '..kdk.....kdk...', '..kdk.....kdk...', '..kk......kk....', '................'], 16),
      fit([...WOLF_TOP, '...kdk...kdk....', '...kdk...kdk....', '....kk....kk....', '................'], 16),
    ],
  },
  {
    key: 'goblin_rider',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 5 }],
    frames: [
      fit([...GOBLIN_TOP, '..kQk.....kQk...', '..kk.......kk...', '................', '................'], 16),
      fit([...GOBLIN_TOP, '...kQk...kQk....', '...kk.....kk....', '................', '................'], 16),
    ],
  },
  {
    key: 'poison_flower',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [
      fit(['................', '................', '.....kk..kk.....', '....kvvkkvvk....', '...kvvvppvvvk...', ...FLOWER_BOTTOM], 16),
      fit(['................', '................', '................', '.....kvvvvk.....', '...kvvvppvvvk...', ...FLOWER_BOTTOM], 16),
    ],
  },
  {
    key: 'treant',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [
      fit([...TREANT_TOP, '...kuuk..kuuk...', '...kkk....kkk...'], 16),
      fit([...TREANT_TOP, '....kuk..kuk....', '....kkk..kkk....'], 16),
    ],
  },
  {
    key: 'varg',
    width: 32,
    height: 24,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [
      fit(
        [
          ...VARG_TOP,
          '....kdk..kddk..kddk.kddk........',
          '....kdk..kdk....kdk..kdk........',
          '....kdk..kdk....kdk..kdk........',
          '...kssk.kssk...kssk.kssk........',
          '................................',
          '................................',
        ],
        32,
      ),
      fit(
        [
          ...VARG_TOP,
          '.....kdk.kddk...kddkkddk........',
          '.....kdk..kdk...kdk.kdk.........',
          '.....kdk..kdk...kdk.kdk.........',
          '....kssk.kssk..kssk.kssk........',
          '................................',
          '................................',
        ],
        32,
      ),
    ],
  },
  // 旧道に停まっている古い FIT（色あせた灰色・誰も乗っていない）
  {
    key: 'car_wreck',
    width: 16,
    height: 16,
    frames: [
      [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '.....kdddk.ka...',
        '..kkkkdddkkka...',
        '.kmmmummmmmmmk..',
        'kmmmmmmmummmmsk.',
        'kdmmummmmmmmmmk.',
        'kddddddudddddddk',
        '..kmmsk...kmmsk.',
        '..kmssk...kmssk.',
        '...kkk.....kkk..',
        '................',
      ].map((r) => r.padEnd(16, '.').slice(0, 16)),
    ],
  },
  {
    // 10周目の伏線：錆びたナンバープレート
    key: 'sign_zero',
    width: 16,
    height: 16,
    frames: [
      (x, y) => {
        if (y < 6 || y > 11 || x < 1 || x > 14) return y >= 12 && (x === 4 || x === 11) ? 'u' : '.';
        if (y === 6 || y === 11 || x === 1 || x === 14) return 'k';
        // 「ZERO」をぼんやり
        const text = ['..kkk.kk.kk..k.', '....k.k..k.kk.k', '..kkk.kk.kk..k.'];
        const row = text[y - 7];
        if (row && row[x] === 'k') return 'd';
        return noise(x, y, 31) < 25 ? 'u' : 's';
      },
    ],
  },
  personSprite('npc_villager', 'u', 'c', 'd'),

  // ---------------------------------------------------------------- 第2章 灰の都
  personSprite('npc_clerk', 'u', 'w', 'd'),
  personSprite('npc_ash', 'd', 'm', 'n'),
  {
    key: 'armor_goblin',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 5 }],
    frames: [
      fit([...ARMOR_GOBLIN_TOP, '....kmk.kmk.....', '....kdk.kdk.....', '...kkk..kkk.....', '................'], 16),
      fit([...ARMOR_GOBLIN_TOP, '...kmk..kmk.....', '...kdk..kdk.....', '..kkk...kkk.....', '................'], 16),
    ],
  },
  {
    key: 'golem',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [fit(GOLEM, 16), fit(GOLEM.map((r) => r.replace(/y/g, 'o')), 16)],
  },
  {
    key: 'shadow_wisp',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 6 }],
    frames: [
      fit([...SHADOW_TOP, '..kpp.kppk.ppk..', '.kp...kppk...pk.', '.k.....kk.....k.', '................'], 16),
      fit([...SHADOW_TOP, '..kp.kppppk.pk..', '..kp..kppk..pk..', '...k...kk...k...', '................'], 16),
    ],
  },
  {
    key: 'mage_soldier',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [fit(MAGE_SOLDIER, 16), fit(MAGE_SOLDIER.map((r, i) => (i === 3 ? r.replace('y', 'a') : r)), 16)],
  },
  {
    key: 'runaway_car',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 10 }],
    frames: [recolorCar(EMPTY_CAR_A, 'r', 'p', 'y'), recolorCar(EMPTY_CAR_B, 'r', 'p', 'y')],
  },
  // 廃高速道路に放置された、朽ちた FIT
  { key: 'car_rust', width: 16, height: 16, frames: [recolorCar(EMPTY_CAR_A, 'u', 'Q', 'd')] },
  {
    // 灰の都の巨大時計（コマ0 =「5」、コマ1 =「4」）
    key: 'big_clock',
    width: 32,
    height: 40,
    frames: [clockFrame(DIGIT_5), clockFrame(DIGIT_4)],
  },
  {
    // 第2章ボス「終焉騎士グラディオン」（右向き）
    key: 'gradion',
    width: 32,
    height: 32,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [fit(GRADION, 32), fit(GRADION.map((r, i) => (i >= 20 && i <= 24 ? r.replace('krrr', 'kkrr') : r)), 32)],
  },
  carSprite('car_warrior', 'r', 'p'),
  carSprite('car_mage', 'b', 'n'),
  carSprite('car_hunter', 'g', 't'),
  personSprite('npc_garage', 'u', 'o', 'n'),
  personSprite('npc_mechanic', 'd', 'b', 'b'),
  personSprite('npc_guide', 'y', 'g', 'u'),
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
  {
    // ドロップの光の柱など。色は tint で付ける
    key: 'fx_pixel',
    width: 1,
    height: 1,
    frames: [['w']],
  },
  {
    // レア以上のドロップの輪
    key: 'fx_ring',
    width: 16,
    height: 16,
    frames: [
      (x, y) => {
        const r = Math.hypot(x - 7.5, y - 7.5);
        return r >= 6 && r < 7.5 ? 'w' : '.';
      },
    ],
  },
  {
    // 魔導弾
    key: 'fx_orb',
    width: 6,
    height: 6,
    frames: [
      (x, y) => {
        const r = Math.hypot(x - 2.5, y - 2.5);
        if (r < 1.2) return 'w';
        if (r < 2.2) return 'v';
        if (r < 3) return 'p';
        return '.';
      },
    ],
  },
  // 青白い炎（ヴァルグの蒼炎）と、赤い炎（騎士の轍）
  flameSprite('fx_flame', 'w', 'a', 'c'),
  flameSprite('fx_flame_red', 'y', 'o', 'r'),
  {
    // ボウガンの矢（右向き。回転させて使う）
    key: 'fx_bolt',
    width: 8,
    height: 3,
    frames: [['......s.', 'yuuuuusw', '......s.']],
  },
  {
    key: 'fx_bolt_big',
    width: 12,
    height: 5,
    frames: [['........a...', '.aa.....aaa.', 'aawwwwwwwwwa', '.aa.....aaa.', '........a...']],
  },
  {
    // 爆発・範囲攻撃（白。tint で色付け）
    key: 'fx_blast',
    width: 32,
    height: 32,
    frames: [0, 1, 2].map((f): PixelGen => (x, y) => {
      const r = Math.hypot(x - 15.5, y - 15.5);
      if (f === 0) return r < 9 ? 'w' : '.';
      if (f === 1) return (r >= 10 && r < 13.5) || (r < 7 && (x + y) % 3 === 0) ? 'w' : '.';
      return r >= 13.5 && r < 15.5 && (x + y) % 2 === 0 ? 'w' : '.';
    }),
  },
  {
    // ドロップの足元の光（tint で色付け）
    key: 'fx_glow',
    width: 10,
    height: 4,
    frames: [['..wwwwww..', '.wwwwwwww.', '.wwwwwwww.', '..wwwwww..']],
  },
  {
    key: 'shadow_wide',
    width: 16,
    height: 4,
    frames: [['..kkkkkkkkkkkk..', '.kkkkkkkkkkkkkk.', '.kkkkkkkkkkkkkk.', '..kkkkkkkkkkkk..']],
  },
];

// ---------------------------------------------------------------- 第3章 沈んだ世界

/** 文字の色を置き換える（色違いの敵を作る） */
const recolor = (rows: string[], map: Record<string, string>) =>
  rows.map((r) => [...r].map((ch) => map[ch] ?? ch).join(''));

const SAHAGIN = [
  '................',
  '....kkkk........',
  '...kttttk..k....',
  '..kttatttk.s....',
  '..ktttttk..s....',
  '..kgtttk...s....',
  '...kkttkk..s....',
  '..kttggttk.s....',
  '.kttgggttkks....',
  '.ktkgggktkss....',
  '..kkgggkk..s....',
  '...ktttk...s....',
];
const CRAB = [
  '................',
  '................',
  '.....a....a.....',
  '....aca..aca....',
  '...kacakkacak...',
  '..kmmmmmmmmmmk..',
  '.kmsmwmmmwmsmk..',
  'kkmmmmmmmmmmmkk.',
  'kmkmmmmmmmmmkmk.',
  '.k.kmmmmmmmmk.k.',
  '...kkmkkmkkmk...',
  '....k..k..k.....',
];
const WRAITH = [
  '................',
  '.....kkkk.......',
  '....kaaaak......',
  '...kawaawak.....',
  '...kaaaaaak.....',
  '..kacaaaacak....',
  '..kaaaaaaaak....',
  '.kcaaccaacaak...',
  '.kaaaaaaaaaak...',
  '..kcaakkaacak...',
];
const SOLDIER = [
  '................',
  '.....kkkk.......',
  '....kmmmmk......',
  '....kmnnmk......',
  '....kmmmmk..k...',
  '...kkmmmmkkksk..',
  '..kmgmmmmgmksk..',
  '..kmmmgmmmmksk..',
  '..kbkmmmmkmkk...',
  '...kkmmmmkk.....',
  '....kmmmmk......',
];
const WORM = [
  '................',
  '................',
  '......kkkk......',
  '.....kppppk.....',
  '....kpwkpwpk....',
  '....kpppppk.....',
  '....kvpvpvk.....',
  '.....kpppk......',
  '.....kvpvk......',
  '.....kpppk......',
  '....kkvpvkk.....',
  '...kQQkpkQQk....',
  '..kQQQQQQQQQk...',
  '..kkkkkkkkkkk...',
  '................',
  '................',
];
const DRAGOON = [
  '................................',
  '................................',
  '.......................kkkk.....',
  '......................kbbbbk....',
  '.............a.......kbbnbbbkk..',
  '............aca.....kbbbbbbbbbk.',
  '...........acwca...kbbbwkbbbbbak',
  '..........acwwwca..kbbbbbbbkkk..',
  '.........kacwwwcak.kbbbbbk.aa...',
  '........kkaccwccakkbbbbbk.......',
  '.......knnkacccakbbbbbbk........',
  '......knnnnkkakbbbbbbbk.........',
  '.....knnbnnnnnnbbbbbbk..........',
  '....knnbbnnnnnnnbbbbk...........',
  '...knnbbbnnnnnnnnbbk............',
  '..knnbbbcnnnnnnnnnk.............',
  '..knbbbccnnnnnnnnnk.............',
  '.kknbbccnnnnnnnnnnk.............',
  'kcknbccnnnnnnnnnnk..............',
  'kcckbbnnnnnnnnnnk...............',
  '.kcckbbnnnnnnnnk................',
  '..kcckknnkknnnk.................',
  '...kcck.knk.knk.................',
  '....kk..kk..kk..................',
  '................................',
  '................................',
];
const ABYSS_CRYSTAL_BODY = [
  '................',
  '.......kk.......',
  '......kawk......',
  '.....kawwak.....',
  '....kaawwaak....',
  '....kcaawaak....',
  '...kccaaaaaak...',
  '...kcccaaaaak...',
  '....kccaaaak....',
  '....kcccaaak....',
  '.....kccaak.....',
  '......kcak......',
  '.......kk.......',
  '................',
  '..kvvv....vvvk..',
  '................',
];

CHARACTER_SPRITES.push(
  personSprite('npc_elder', 's', 'p', 'd'),
  personSprite('npc_fisher', 'u', 't', 'n'),
  {
    key: 'aqua_slime',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: (CHARACTER_SPRITES.find((s) => s.key === 'slime')!.frames as string[][]).map((f) =>
      recolor(f, { g: 'c', l: 'a', t: 'n' }),
    ),
  },
  {
    key: 'aqua_slime_shooter',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: (CHARACTER_SPRITES.find((s) => s.key === 'slime')!.frames as string[][]).map((f) =>
      recolor(f, { g: 'b', l: 'a', t: 'n', w: 'y' }),
    ),
  },
  {
    key: 'sahagin',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 5 }],
    frames: [
      fit([...SAHAGIN, '...kt.tk........', '..ktk.ktk.......', '..kk...kk.......', '................'], 16),
      fit([...SAHAGIN, '...kt.tk........', '...kt..kt.......', '...kk..kk.......', '................'], 16),
    ],
  },
  {
    key: 'crystal_crab',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [fit([...CRAB, '', '', '', ''], 16), fit(['', ...CRAB, '', '', ''], 16)],
  },
  {
    key: 'abyss_wraith',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [
      fit([...WRAITH, '..ka..kaak..ak..', '...k...kk...k...', '', '', '', ''], 16),
      fit([...WRAITH, '..kak.kaak.kak..', '...k..k..k..k...', '', '', '', ''], 16),
    ],
  },
  {
    key: 'sunken_soldier',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [
      fit([...SOLDIER, '....kmk.kmk.....', '....kdk.kdk.....', '...kkk..kkk.....', '', ''], 16),
      fit([...SOLDIER, '...kmk..kmk.....', '...kdk..kdk.....', '..kkk...kkk.....', '', ''], 16),
    ],
  },
  {
    // レアモンスター：黒い水没鎧、赤く光る目
    key: 'forgotten_knight',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [
      fit(recolor([...SOLDIER, '....kmk.kmk.....', '....kdk.kdk.....', '...kkk..kkk.....', '', ''], { m: 'd', g: 'p', n: 'r', s: 'm', b: 'p' }), 16),
      fit(recolor([...SOLDIER, '...kmk..kmk.....', '...kdk..kdk.....', '..kkk...kkk.....', '', ''], { m: 'd', g: 'p', n: 'r', s: 'm', b: 'p' }), 16),
    ],
  },
  {
    key: 'deep_worm',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [fit(WORM, 16), fit(['', ...WORM.slice(0, 15)], 16)],
  },
  {
    // 第3章ボス「アビス・ドラグーン」（右向き）。背中の水晶が光る
    key: 'abyss_dragoon',
    width: 32,
    height: 26,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [fit(DRAGOON, 32), fit(recolor(DRAGOON, { w: 'a', a: 'w' }), 32)],
  },
  // 記憶の結晶（ボスを倒すと現れる）
  { key: 'memory_crystal', width: 16, height: 16, frames: [ABYSS_CRYSTAL_BODY] },
  {
    // 宝箱（コマ0 = 閉じている / コマ1 = 開いている）
    key: 'chest',
    width: 16,
    height: 16,
    frames: [
      fit(['', '', '', '', '..kkkkkkkkkkk...', '.kuuuuuuuuuuuk..', '.kuQQQQQQQQQuk..', '.kkkkkkykkkkkk..', '.kuuuuukyuuuuk..', '.kuQQQQQQQQQuk..', '.kuuuuuuuuuuuk..', '.kkkkkkkkkkkkk..'], 16),
      fit(['', '', '..kkkkkkkkkkk...', '.kuQQQQQQQQQuk..', '.kkkkkkkkkkkkk..', '.kyywyyyyywyyk..', '.kkkkkkkkkkkkk..', '.kuuuuuuuuuuuk..', '.kuuuuuuuuuuuk..', '.kuQQQQQQQQQuk..', '.kuuuuuuuuuuuk..', '.kkkkkkkkkkkkk..'], 16),
    ],
  },
  {
    // 古代壁画：FIT と、それに乗る主人公によく似た人物
    key: 'mural',
    width: 32,
    height: 24,
    frames: [
      (x, y) => {
        if (x === 0 || x === 31 || y === 0 || y === 23) return 'k';
        if (x === 1 || x === 30 || y === 1 || y === 22) return 'Y';
        // 描かれた車と人物（主人公の車の絵を拡大して刻んだもの）
        const cx = Math.floor((x - 8) / 1);
        const cy = y - 5;
        const row = CAR_BODY[cy] ?? (cy >= 12 && cy < 16 ? CAR_WHEELS_A[cy - 12] : undefined);
        if (row && cx >= 0 && cx < 16) {
          const ch = row[cx];
          if (ch === 'k') return 'n';
          if (ch !== '.') return ch === 'X' || ch === 'Z' ? 'b' : ch === 'f' || ch === 'u' ? 'y' : 'c';
        }
        return noise(x, y, 61) < 14 ? 'Y' : noise(x, y, 62) < 6 ? 'g' : 'V';
      },
    ],
  },
);

EFFECT_SPRITES.push(
  {
    key: 'fx_water_orb',
    width: 6,
    height: 6,
    frames: [
      (x, y) => {
        const r = Math.hypot(x - 2.5, y - 2.5);
        if (r < 1.2) return 'w';
        if (r < 2.2) return 'a';
        if (r < 3) return 'c';
        return '.';
      },
    ],
  },
  {
    key: 'fx_crystal_shard',
    width: 5,
    height: 9,
    frames: [['..k..', '.kak.', '.kwk.', 'kawak', 'kawck', 'kacck', '.kck.', '.kck.', '..k..']],
  },
);

// ---------------------------------------------------------------- 第4章 終焉王国

const DRAGON_KNIGHT = [
  '........................',
  '...........kkk..........',
  '..........kdddk.........',
  '..........kdrrk.........',
  'k.........kdddk.......k.',
  'kk.......kkyyykk.....kk.',
  'kpk.....kdddddddk...kpk.',
  'kppk...kdddyyydddk.kppk.',
  '.kppkkkddyddddyddkkppk..',
  '..kppppkddddddddkppppk..',
  '...kpppkddddddddkpppk...',
  '....kkkkdddyydddkkkk....',
  '.......kdddddddddk......',
  '.......kkdddkdddkk......',
  '........kddk.kddk.......',
  '........kddk.kddk.......',
  '........kyyk.kyyk.......',
  '........kkkk.kkkk.......',
  '........................',
  '........................',
];
/** 竜騎士の槍（右上へ向ける） */
const withLance = (rows: string[]): PixelGen => (x, y) => {
  const lance = [
    [17, 9, 'u'],
    [18, 8, 'u'],
    [19, 7, 'u'],
    [20, 6, 's'],
    [21, 5, 'w'],
    [22, 4, 'w'],
    [23, 3, 'w'],
  ] as const;
  for (const [lx, ly, c] of lance) if (lx === x && ly === y) return c;
  return rows[y]?.[x] ?? '.';
};

const CHRONOS_BODY = [
  '................................',
  '................................',
  '..............y.y.y.............',
  '.............kyyyyyk............',
  '.............kdddddk............',
  '.............kdEdEdk............',
  '.............kdddddk............',
  '..............kdddk.............',
  '.........kkkkkyyyyykkkkk........',
  '........kddyydddddddyyddk.......',
  '.......kdddkyddddddyykdddk......',
  '.......kddk.kddyyddk..kddk......',
  '......kaak..kdddddddk..kddk.....',
  '.....kavvak.kdyyyydk....kddk....',
  '.....kaavak.kdddddddk....kyyk...',
  '......kaak..kddddddk.....kyyk...',
  '.......kk...kyyyyyyk......kk....',
  '...........krrrrrrrrk...........',
  '..........krrrrdrrrrrk..........',
  '..........krrrdddrrrrk..........',
  '...........kkdddkdddkk..........',
  '............kdddkdddk...........',
  '............kdddkdddk...........',
  '............kyydkdyyk...........',
  '............kdddkdddk...........',
  '...........kddddkddddk..........',
  '...........kkkkkkkkkkk..........',
];
/**
 * 第4章ボス「輪廻王クロノス」（右向き・32x32）。
 * 背中に巨大な時計盤、右手に大剣、左腕に時間を操る魔導装置（水色）。phase で針の角度と目の光が変わる
 */
const chronosFrame = (phase: number): PixelGen => (x, y) => {
  const by = y - 3;
  const row = CHRONOS_BODY[by];
  let ch = row?.[x] ?? '.';
  if (ch === 'E') ch = phase ? 'w' : 'a';
  if (ch !== '.') return ch;
  // 大剣（刃は右手の上）
  if (by >= -2 && by <= 12 && (x === 26 || x === 27)) return by <= -2 ? 'k' : x === 26 ? 's' : 'w';
  if (by === 13 && x >= 24 && x <= 29) return x === 24 || x === 29 ? 'k' : 'y';
  // 背中の時計盤
  const cx = 16;
  const cy = 13;
  const r = Math.hypot(x - cx, y - cy);
  if (r > 12.5) return '.';
  if (r > 11.4) return 'k';
  if (r > 10) return 'y';
  // 目盛り
  const ang = Math.atan2(y - cy, x - cx);
  const tick = Math.abs(((ang / (Math.PI / 6)) % 1) + 1) % 1;
  if (r > 8.5 && (tick < 0.12 || tick > 0.88)) return 'y';
  // 針
  const hand = phase ? -0.6 : -2.2;
  const along = (x - cx) * Math.cos(hand) + (y - cy) * Math.sin(hand);
  const across = Math.abs(-(x - cx) * Math.sin(hand) + (y - cy) * Math.cos(hand));
  if (along > 0 && along < 9 && across < 0.8) return 'y';
  return r < 1.5 ? 'y' : 'n';
};

const DEMON_CAR_TOP = [
  '................',
  '................',
  '.....k...k......',
  '.....rk.kr......',
  '.....krrrk......',
  '.....kryrk.ka...',
  '..kkkkrrrkkka...',
];
const demonCar = (base: string[]) => recolorCar([...DEMON_CAR_TOP, ...base.slice(7)], 'p', 'd', 'r').map((r) => r.padEnd(16, '.'));

CHARACTER_SPRITES.push(
  personSprite('npc_guard', 'd', 'Y', 'd'),
  personSprite('npc_scholar', 's', 'p', 'd'),
  personSprite('npc_lady', 'y', 'r', 'd'),
  personSprite('npc_kid', 'u', 'g', 'd'),
  {
    key: 'fallen_soldier',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [
      fit(recolor([...SOLDIER, '....kmk.kmk.....', '....kdk.kdk.....', '...kkk..kkk.....', '', ''], { m: 'V', n: 'r', g: 'y', b: 'r' }), 16),
      fit(recolor([...SOLDIER, '...kmk..kmk.....', '...kdk..kdk.....', '..kkk...kkk.....', '', ''], { m: 'V', n: 'r', g: 'y', b: 'r' }), 16),
    ],
  },
  {
    key: 'black_knight',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [
      fit(recolor([...SOLDIER, '....kmk.kmk.....', '....kdk.kdk.....', '...kkk..kkk.....', '', ''], { m: 'd', g: 'y', n: 'r', s: 'w', b: 'y' }), 16),
      fit(recolor([...SOLDIER, '...kmk..kmk.....', '...kdk..kdk.....', '..kkk...kkk.....', '', ''], { m: 'd', g: 'y', n: 'r', s: 'w', b: 'y' }), 16),
    ],
  },
  {
    // レアモンスター「輪廻の騎士」：紫の鎧、水色に光る目
    key: 'rinne_knight',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [
      fit(recolor([...SOLDIER, '....kmk.kmk.....', '....kdk.kdk.....', '...kkk..kkk.....', '', ''], { m: 'p', g: 'y', n: 'a', s: 'v', b: 'v' }), 16),
      fit(recolor([...SOLDIER, '...kmk..kmk.....', '...kdk..kdk.....', '..kkk...kkk.....', '', ''], { m: 'p', g: 'y', n: 'a', s: 'v', b: 'v' }), 16),
    ],
  },
  {
    // 王国の魔導兵：黒いローブに金の紋章
    key: 'kingdom_mage',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [
      fit(recolor(MAGE_SOLDIER, { p: 'd', v: 'y' }), 16),
      fit(recolor(MAGE_SOLDIER.map((r, i) => (i === 3 ? r.replace('y', 'a') : r)), { p: 'd', v: 'y' }), 16),
    ],
  },
  {
    key: 'nightmare_hound',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 8 }],
    frames: [
      fit(recolor([...WOLF_TOP, '..kdk.....kdk...', '..kdk.....kdk...', '..kk......kk....', '................'], { m: 'd', s: 'p', d: 'n' }), 16),
      fit(recolor([...WOLF_TOP, '...kdk...kdk....', '...kdk...kdk....', '....kk....kk....', '................'], { m: 'd', s: 'p', d: 'n' }), 16),
    ],
  },
  {
    // 魔物が運転する暴走車
    key: 'demons_rider',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 12 }],
    frames: [demonCar(EMPTY_CAR_A), demonCar(EMPTY_CAR_B)],
  },
  {
    key: 'dragon_knight',
    width: 24,
    height: 20,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 4 }],
    frames: [withLance(DRAGON_KNIGHT), withLance(['', ...DRAGON_KNIGHT.slice(0, 19)].map((r) => r.padEnd(24, '.')))],
  },
  {
    key: 'chronos',
    width: 32,
    height: 32,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [chronosFrame(0), chronosFrame(1)],
  },
  {
    // 倒れかけた兵士の像
    key: 'soldier_statue',
    width: 16,
    height: 16,
    frames: [
      [
        '................',
        '......kkk.......',
        '.....kssmk......',
        '.....kmsmk......',
        '......kmk...k...',
        '....kkssskkksk..',
        '...ksmsssmsksk..',
        '...ksmsssmmksk..',
        '...kmkssskmkk...',
        '....kksssmk.....',
        '.....ksmsmk.....',
        '.....kmk.kmk....',
        '...kkkkkkkkkkk..',
        '..kVVVVVVVVVVVk.',
        '..kYYYYYYYYYYYk.',
        '..kkkkkkkkkkkkk.',
      ],
    ],
  },
  {
    // 古い記録（石板）
    key: 'record_stone',
    width: 16,
    height: 16,
    frames: [
      [
        '................',
        '....kkkkkkkk....',
        '...kVVVVVVVVk...',
        '...kVkkVkVVVk...',
        '...kVVVVVVVVk...',
        '...kVkVkkkVVk...',
        '...kVVVVVVVVk...',
        '...kVkkkVkkVk...',
        '...kVVVVVVVVk...',
        '...kVkVVkkkVk...',
        '...kVVVVVVVVk...',
        '...kYYYYYYYYk...',
        '..kkkkkkkkkkkk..',
        '..kYYYYYYYYYYk..',
        '..kkkkkkkkkkkk..',
        '................',
      ],
    ],
  },
  {
    // 記憶の結晶をかざす祭壇（光がゆらぐ）
    key: 'crystal_altar',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [
      [
        '................',
        '.......kk.......',
        '......kawk......',
        '.....kawwak.....',
        '.....kcaaak.....',
        '......kcak......',
        '.......kk.......',
        '....kkkkkkkk....',
        '...kyyyyyyyyk...',
        '....kVVVVVVk....',
        '....kVYYYYVk....',
        '....kVVVVVVk....',
        '....kVYYYYVk....',
        '...kkkkkkkkkk...',
        '..kVVVVVVVVVVk..',
        '..kkkkkkkkkkkk..',
      ],
      [
        '................',
        '.......kk.......',
        '......kwwk......',
        '.....kwwwak.....',
        '.....kawwak.....',
        '......kaak......',
        '.......kk.......',
        '....kkkkkkkk....',
        '...kyyyyyyyyk...',
        '....kVVVVVVk....',
        '....kVYYYYVk....',
        '....kVVVVVVk....',
        '....kVYYYYVk....',
        '...kkkkkkkkkk...',
        '..kVVVVVVVVVVk..',
        '..kkkkkkkkkkkk..',
      ],
    ],
  },
  {
    // 道の終わりの柵（世界の果て）
    key: 'road_end',
    width: 16,
    height: 16,
    frames: [
      [
        '................',
        '................',
        '................',
        '................',
        '.kkkkkkkkkkkkkk.',
        '.kwwrrwwrrwwrrk.',
        '.krrwwrrwwrrwwk.',
        '.kkkkkkkkkkkkkk.',
        '..kmk......kmk..',
        '..kmk......kmk..',
        '..kmk......kmk..',
        '..kmk......kmk..',
        '.kkkkk....kkkkk.',
        '................',
        '................',
        '................',
      ],
    ],
  },
);

// ---------------------------------------------------------------- 最終章 世界の果て

/** 16x16 の絵を 2 倍（32x32）に拡大する（大きな FIT のボス） */
const scale2 = (rows: string[]) => rows.flatMap((r) => {
  const wide = [...r].map((ch) => ch + ch).join('');
  return [wide, wide];
});

/** 時計の歯車をはめこんだゴーレム（クロノゴーレム） */
const CHRONO_GOLEM = GOLEM.map((r, i) => (i === 8 ? r.replace('VVaVV', 'VyayV') : r));

/** 記録から生まれた人影（データゴースト）：ところどころ欠けて、ちらつく */
const dataGhost = (seed: number): PixelGen => (x, y) => {
  const row = PERSON[y];
  const ch = row?.[x] ?? '.';
  if (ch === '.') return '.';
  if (noise(x, y, seed) < 14) return '.';
  if (ch === 'k') return 'n';
  if (ch === 'H') return 'a';
  if (ch === 'C') return 'c';
  if (ch === 'D') return 'b';
  if (ch === 'f') return 'a';
  return 'w';
};

/** 砂時計のような時間の魔物（リピート） */
const REPEAT = [
  '................',
  '....kkkkkkkk....',
  '....kyyyyyyk....',
  '.....kvvvvk.....',
  '......kvvk......',
  '.......kk.......',
  '......kaak......',
  '.....kawwak.....',
  '....kaawwaak....',
  '....kkkkkkkk....',
  '....k......k....',
  '...kk......kk...',
  '................',
  '................',
  '................',
  '................',
];

CHARACTER_SPRITES.push(
  personSprite('hero_ghost', 'u', 'r', 'd'),
  {
    // 最終ボス ZERO：黒い金属とエネルギーでできた大きな FIT。赤いヘッドライト
    key: 'zero',
    width: 32,
    height: 32,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 6 }],
    frames: [scale2(recolorCar(EMPTY_CAR_A, 'd', 'k', 'r')), scale2(recolorCar(EMPTY_CAR_B, 'd', 'k', 'w'))],
  },
  {
    // 第二形態：赤い FIT（初代）
    key: 'zero_red',
    width: 32,
    height: 32,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 10 }],
    frames: [scale2(recolorCar(EMPTY_CAR_A, 'r', 'p', 'y')), scale2(recolorCar(EMPTY_CAR_B, 'r', 'p', 'y'))],
  },
  {
    // 第二形態：水色の FIT（二代目）
    key: 'zero_cyan',
    width: 32,
    height: 32,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 10 }],
    frames: [scale2(recolorCar(EMPTY_CAR_A, 'c', 'b', 'w')), scale2(recolorCar(EMPTY_CAR_B, 'c', 'b', 'w'))],
  },
  {
    key: 'repeat_wisp',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [REPEAT, REPEAT.map((r, i) => (i === 7 ? r.replace('kawwak', 'kwaawk') : r))],
  },
  {
    key: 'chrono_golem',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [fit(recolor(CHRONO_GOLEM, { V: 'm', Y: 'd' }), 16), fit(recolor(CHRONO_GOLEM, { V: 'm', Y: 'd', a: 'w' }), 16)],
  },
  {
    key: 'zero_hound',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 8 }],
    frames: [
      fit(recolor([...WOLF_TOP, '..kdk.....kdk...', '..kdk.....kdk...', '..kk......kk....', '................'], { m: 'd', s: 'w', r: 'a', d: 'n' }), 16),
      fit(recolor([...WOLF_TOP, '...kdk...kdk....', '...kdk...kdk....', '....kk....kk....', '................'], { m: 'd', s: 'w', r: 'a', d: 'n' }), 16),
    ],
  },
  {
    key: 'data_ghost',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 8 }],
    frames: [dataGhost(91), dataGhost(92)],
  },
  {
    // 古代施設の「世界再構築システム」：FIT と同じ形をした装置
    key: 'fit_device',
    width: 32,
    height: 32,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 2 }],
    frames: [scale2(recolorCar(EMPTY_CAR_A, 'm', 'd', 'a')), scale2(recolorCar(EMPTY_CAR_A, 'm', 'd', 'w'))],
  },
  {
    // 過去の主人公の記録が残された端末
    key: 'memory_terminal',
    width: 16,
    height: 16,
    anims: [{ name: 'idle', frames: [0, 1], frameRate: 3 }],
    frames: [
      [
        '................',
        '..kkkkkkkkkkkk..',
        '..knnnnnnnnnnk..',
        '..knaaanwaannk..',
        '..knnnnnnnnnnk..',
        '..knanaaanwnnk..',
        '..knnnnnnnnnnk..',
        '..kkkkkkkkkkkk..',
        '......kmmk......',
        '......kmmk......',
        '.....kmmmmk.....',
        '....kddddddk....',
        '....kkkkkkkk....',
        '................',
        '................',
        '................',
      ],
      [
        '................',
        '..kkkkkkkkkkkk..',
        '..knnnnnnnnnnk..',
        '..knwaanaaannk..',
        '..knnnnnnnnnnk..',
        '..knaawnanaank..',
        '..knnnnnnnnnnk..',
        '..kkkkkkkkkkkk..',
        '......kmmk......',
        '......kmmk......',
        '.....kmmmmk.....',
        '....kddddddk....',
        '....kkkkkkkk....',
        '................',
        '................',
        '................',
      ],
    ],
  },
);

/** 丸い弾（色違い） */
const orb = (key: string, core: string, mid: string, outer: string): PixelSprite => ({
  key,
  width: 6,
  height: 6,
  frames: [
    (x, y) => {
      const r = Math.hypot(x - 2.5, y - 2.5);
      if (r < 1.2) return core;
      if (r < 2.2) return mid;
      if (r < 3) return outer;
      return '.';
    },
  ],
});

EFFECT_SPRITES.push(orb('fx_orb_red', 'w', 'o', 'r'), orb('fx_orb_cyan', 'w', 'a', 'c'));

// 回復アイテム「ガソリン」の缶（白で描き、レアリティの色を乗せる）
EFFECT_SPRITES.push({
  key: 'gas_can',
  width: 10,
  height: 12,
  frames: [
    [
      '...kkk....',
      '..kwwwk...',
      '.kkkkkkkk.',
      '.kwwwwwwk.',
      '.kwkwwkwk.',
      '.kwwkkwwk.',
      '.kwwkkwwk.',
      '.kwkwwkwk.',
      '.kwwwwwwk.',
      '.ksssssssk',
      '.kkkkkkkk.',
      '..........',
    ].map((r) => r.padEnd(10, '.').slice(0, 10)),
  ],
});

// 前の周回のタイヤの跡（はじまりの森・2周目〜）
CHARACTER_SPRITES.push({
  key: 'tire_tracks',
  width: 16,
  height: 16,
  frames: [(x, y) => ((x === 4 || x === 5 || x === 10 || x === 11) && (y + (x > 8 ? 2 : 0)) % 4 < 2 ? 'J' : '.')],
});

// ---------------------------------------------------------------- アイコン（12x12）

const icon = (key: string, rows: string[]): PixelSprite => ({ key, width: 12, height: 12, frames: [rows] });

export const ICON_SPRITES: PixelSprite[] = [
  icon('icon_bumper', [
    '............',
    '............',
    '...s....s...',
    '..ksk..ksk..',
    '.kkskkkkskk.',
    'kssssssssssk',
    'kswwwwwwwwsk',
    'ksmmmmmmmmsk',
    'kkkkkkkkkkkk',
    '............',
    '............',
    '............',
  ]),
  icon('icon_engine', [
    '............',
    '....kkkk....',
    '...kppppk...',
    '..kkkkkkkk..',
    '.kmsmsmsmsk.',
    '.kmaaaaaamk.',
    '.kmacccaamk.',
    '.kmaaaaaamk.',
    '.kmsmsmsmsk.',
    '..kkkkkkkk..',
    '...kk..kk...',
    '............',
  ]),
  icon('icon_turret', [
    '............',
    '.kk......kk.',
    '..kuk..kuk..',
    '...kuuuuk...',
    '....kssk....',
    '.....sw.....',
    '.....sw.....',
    '....kuuk....',
    '....kuuk....',
    '....kuuk....',
    '.....kk.....',
    '............',
  ]),
  icon('icon_helmet', [
    '............',
    '............',
    '...kkkkkk...',
    '..krrrrwrk..',
    '.krrrrrrwrk.',
    '.krrrrrrrrk.',
    '.kaaaaarrrk.',
    '.kaaaaarrrk.',
    '.kkkkkkkkkk.',
    '............',
    '............',
    '............',
  ]),
  icon('icon_armor', [
    '............',
    '..kk....kk..',
    '.kssk..kssk.',
    '.ksmskksmsk.',
    '.kssssssssk.',
    '.ksmssssmsk.',
    '.kssssssssk.',
    '.ksmssssmsk.',
    '..kssssssk..',
    '...kkkkkk...',
    '............',
    '............',
  ]),
  icon('icon_handle', [
    '............',
    '...kkkkkk...',
    '..kddddddk..',
    '.kdk....kdk.',
    '.kd......dk.',
    '.kdkkkkkkdk.',
    '.kdkmssmkdk.',
    '.kd..km..dk.',
    '.kdk.km.kdk.',
    '..kddddddk..',
    '...kkkkkk...',
    '............',
  ]),
  icon('icon_tire', [
    '............',
    '...kkkkkk...',
    '..kdmdmdmk..',
    '.kdkkkkkkdk.',
    '.kmkswwskmk.',
    '.kdksmmskdk.',
    '.kmksmmskmk.',
    '.kdkswwskdk.',
    '.kmkkkkkkmk.',
    '..kdmdmdmk..',
    '...kkkkkk...',
    '............',
  ]),
  icon('icon_charm', [
    '............',
    '.....kk.....',
    '....kyyk....',
    '...kkkkkk...',
    '...krrrrk...',
    '...kryyrk...',
    '...krwwrk...',
    '...krwwrk...',
    '...kryyrk...',
    '...krrrrk...',
    '...kkkkkk...',
    '............',
  ]),
  icon('icon_navi', [
    '............',
    '............',
    '.kkkkkkkkkk.',
    '.kddddddddk.',
    '.kdccgcccdk.',
    '.kdcgggccdk.',
    '.kdccgcrcdk.',
    '.kddddddddk.',
    '.kkkkkkkkkk.',
    '....kmmk....',
    '...kkkkkk...',
    '............',
  ]),
  icon('icon_fang', [
    '............',
    '.........ww.',
    '........wsw.',
    '.......wsw..',
    '......wsw...',
    '.....wsw....',
    '....wsw.....',
    '...wsw......',
    '..wsw.......',
    '.wsk........',
    '.kk.........',
    '............',
  ]),
  icon('icon_memory', [
    '............',
    '.....kk.....',
    '....kawk....',
    '...kawwak...',
    '...kaawak...',
    '..kcaawaak..',
    '..kccaaaak..',
    '...kccaak...',
    '...kccaak...',
    '....kcak....',
    '.....kk.....',
    '............',
  ]),
  icon('icon_shard', [
    '............',
    '.....kk.....',
    '....kvyk....',
    '...kvvyyk...',
    '..kpvvyyyk..',
    '..kpvvywyk..',
    '...kpvyyk...',
    '....kpvk....',
    '.....kk.....',
    '............',
    '............',
    '............',
  ]),
  icon('icon_status', [
    '............',
    '........kkk.',
    '........kyk.',
    '....kkk.kyk.',
    '....kok.kyk.',
    'kkk.kok.kyk.',
    'klk.kok.kyk.',
    'klk.kok.kyk.',
    'klk.kok.kyk.',
    'kkkkkkkkkkk.',
    '............',
    '............',
  ]),
  icon('icon_lost', [
    '............',
    '....kkkk....',
    '...kwaawk...',
    '..kwa..awk..',
    '..ka.kk.ak..',
    '..ka.kk.ak..',
    '..kwa..awk..',
    '...kwaawk...',
    '....kkkk....',
    '.....kk.....',
    '....kyyk....',
    '....kkkk....',
  ]),
  icon('icon_bag', [
    '............',
    '....kkkk....',
    '...ku..uk...',
    '..kkkkkkkk..',
    '.kuuuuuuuuk.',
    '.kuQQQQQQuk.',
    '.kuuuyyuuuk.',
    '.kuuuyyuuuk.',
    '.kuuuuuuuuk.',
    '.kQuuuuuuQk.',
    '..kkkkkkkk..',
    '............',
  ]),
];

// ---------------------------------------------------------------- タイル（16x16）
// data/tiles.ts のタイル名と対応させる

const grassGen = (seed: number): PixelGen => (x, y) => {
  const n = noise(x, y, seed);
  if (n < 6) return 'H';
  if (n < 10) return 'J';
  return 'G';
};

/** アスファルト（ひび割れ入り） */
const asphaltGen: PixelGen = (x, y) => {
  const n = noise(x, y, 51);
  if (n < 4) return 'k';
  if (n < 12) return 'm';
  return 'd';
};

/** 石畳（互い違いのレンガ目地） */
const stoneGen: PixelGen = (x, y) => {
  const off = Math.floor(y / 8) % 2 ? 4 : 0;
  if (y % 8 === 7 || (x + off) % 8 === 7) return 'Y';
  const n = noise(x, y, 17);
  if (n < 7) return 'Y';
  if (n < 12) return 'E';
  return 'V';
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
  // ---- 町
  stone: (x, y) => stoneGen(x, y),
  roof: (x, y) => {
    if (y % 4 === 3) return 'p';
    if (y % 4 === 0 && noise(x, y, 21) < 25) return 'o';
    return 'r';
  },
  wall: (x, y) => {
    if (x === 0 || x === 15 || y === 0 || y === 15) return 'B';
    if (x >= 5 && x <= 10 && y >= 4 && y <= 10) {
      if (x === 5 || x === 10 || y === 4 || y === 10 || x === 7 || y === 7) return 'B';
      return x < 8 && y < 7 ? 'a' : 'c';
    }
    return noise(x, y, 23) < 6 ? 'P' : 'E';
  },
  door: (x, y) => {
    if (x < 3 || x > 12) return x === 0 || x === 15 || y === 15 ? 'B' : 'E';
    if (y < 2) return 'B';
    if (x === 3 || x === 12 || y === 2) return 'k';
    if (x === 10 && y === 9) return 'y';
    return x % 3 === 0 ? 'B' : 'u';
  },
  fence: (x, y) => {
    const g = grassGen(9)(x, y);
    const post = x === 2 || x === 3 || x === 12 || x === 13;
    if (post && y >= 4 && y <= 13) return x === 2 || x === 12 ? 'B' : 'u';
    if ((y === 6 || y === 10) && x >= 0) return 'u';
    if (y === 7 || y === 11) return 'B';
    return g;
  },
  gate: (x, y) => {
    const r = Math.hypot(x - 7.5, y - 7.5);
    if (r < 2) return 'w';
    if (r >= 5 && r < 6.5) return 'a';
    if (r >= 6.5 && r < 7.5) return 'c';
    return stoneGen(x, y);
  },
  // ---- 灰の都・廃高速道路
  ash_stone: (x, y) => {
    const off = Math.floor(y / 8) % 2 ? 4 : 0;
    if (y % 8 === 7 || (x + off) % 8 === 7) return 'd';
    const n = noise(x, y, 41);
    if (n < 6) return 'd';
    if (n < 10) return 's';
    return 'm';
  },
  ash_wall: (x, y) => {
    if (y === 0) return 'k';
    // 窓（ところどころ明かりがついている）
    if (x % 5 >= 1 && x % 5 <= 2 && y % 6 >= 2 && y % 6 <= 4) return noise(Math.floor(x / 5), Math.floor(y / 6), 43) < 30 ? 'y' : 'n';
    return noise(x, y, 44) < 8 ? 'm' : 'd';
  },
  ash_roof: (x, y) => (y % 4 === 3 ? 'k' : noise(x, y, 45) < 10 ? 's' : 'm'),
  asphalt: (x, y) => asphaltGen(x, y),
  lane: (x, y) => (x >= 7 && x <= 8 && y % 8 < 5 ? 'y' : asphaltGen(x, y)),
  guardrail: (x, y) => {
    if (x < 5 || x > 10) return asphaltGen(x, y);
    if (x === 5 || x === 10) return 'k';
    if (y % 8 === 0) return 'd';
    return x === 7 || x === 8 ? 'w' : 's';
  },
  debris: (x, y) => {
    // コンクリートの破片
    const n = noise(Math.floor(x / 3), Math.floor(y / 3), 47);
    if (n < 55) {
      const e = noise(x, y, 48);
      return e < 15 ? 'k' : e < 45 ? 'Y' : e < 80 ? 'V' : 's';
    }
    return asphaltGen(x, y);
  },
  // ---- 沈没都市・潮見の港
  shallow: (x, y) => {
    const wave = (x + Math.floor(y / 4) * 5) % 8;
    if (y % 4 === 2 && wave < 3) return 'w';
    if (noise(x, y, 71) < 10) return 'a';
    return 'c';
  },
  sunken_road: (x, y) => {
    const off = Math.floor(y / 8) % 2 ? 4 : 0;
    if (y % 8 === 7 || (x + off) % 8 === 7) return 'n';
    const n = noise(x, y, 72);
    if (n < 5) return 'g';
    if (n < 12) return 'b';
    return 'm';
  },
  ruin: (x, y) => {
    if (x === 0 || x === 15) return 'k';
    if (y % 5 === 4) return 'Y';
    // 刻まれた古代文字
    if ((x === 5 || x === 10) && y % 5 >= 1 && y % 5 <= 2) return 'a';
    return noise(x, y, 73) < 10 ? 'g' : 'V';
  },
  crystal: (x, y) => {
    const d = Math.abs(x - 7.5) + Math.abs(y - 9) * 0.6;
    if (d < 2.5 && y > 1) return y < 6 ? 'w' : 'a';
    if (d < 4.5 && y > 1) return 'c';
    if (d < 5.5 && y > 1) return 'n';
    return noise(x, y, 74) < 12 ? 'n' : 'm';
  },
  pier: (x, y) => (y % 4 === 3 ? 'B' : noise(x, y, 75) < 8 ? 'Q' : 'u'),
  // ---- 城塞都市・終焉王国
  royal_stone: (x, y) => {
    const off = Math.floor(y / 8) % 2 ? 4 : 0;
    if (y % 8 === 7 || (x + off) % 8 === 7) return 'Y';
    const n = noise(x, y, 81);
    if (n < 6) return 'Y';
    if (n < 12) return 'E';
    return 'V';
  },
  castle_wall: (x, y) => {
    if (y === 0) return 's';
    const off = Math.floor(y / 4) % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) return 'd';
    const n = noise(x, y, 82);
    if (n < 8) return 'G';
    if (n < 20) return 's';
    return 'm';
  },
  pillar: (x, y) => {
    if (x < 4 || x > 11) {
      const off = Math.floor(y / 8) % 2 ? 4 : 0;
      return y % 8 === 7 || (x + off) % 8 === 7 ? 'Y' : 'V';
    }
    if (x === 4 || x === 11) return 'k';
    if (y < 2 || y > 13) return 'y';
    return x < 7 ? 's' : x < 10 ? 'm' : 'd';
  },
  // 並べると1枚の絨毯に見えるよう、ふちは描かない（ひし形の模様だけ）
  carpet: (x, y) => {
    if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) return (x + y) % 16 === 0 ? 'y' : 'p';
    return noise(x, y, 84) < 6 ? 'p' : 'r';
  },
  void: (x, y) => {
    const n = noise(x, y, 83);
    return n < 1 ? 's' : n < 3 ? 'n' : 'k';
  },
  water: (x, y) => {
    const wave = (x + Math.floor(y / 4) * 5) % 8;
    if (y % 4 === 1 && wave < 3) return 'a';
    if (noise(x, y, 5) < 8) return 'c';
    return 'b';
  },
};

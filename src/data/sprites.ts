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
  water: (x, y) => {
    const wave = (x + Math.floor(y / 4) * 5) % 8;
    if (y % 4 === 1 && wave < 3) return 'a';
    if (noise(x, y, 5) < 8) return 'c';
    return 'b';
  },
};

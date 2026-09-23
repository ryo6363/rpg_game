// バランス調整用の数値はすべてここに集約する

/** 表示まわり */
export const DISPLAY = {
  /** 論理解像度の横幅（px）。縦は端末比率で可変 */
  baseWidth: 180,
  tileSize: 16,
  /** マップ外周に自動で足す木の幅（タイル数）。端でもキャラが操作ボタンに隠れないように */
  mapPadX: 3,
  mapPadY: 8,
  fontFamily: '"DotGothic16", "Hiragino Kaku Gothic ProN", sans-serif',
  showFps: true,
} as const;

/** 操作まわり */
export const CONTROLS = {
  /** 仮想スティックの最大移動半径（論理px） */
  stickRadius: 15,
  /** これ未満の入力は無視 */
  stickDeadZone: 0.15,
  /** 画面のこの割合より下・左半分をスティック領域にする */
  stickAreaTopRatio: 0.4,
  attackButtonRadius: 16,
  skillButtonRadius: 9,
} as const;

/** プレイヤー共通 */
export const PLAYER = {
  /** 攻撃中の移動速度倍率 */
  attackMoveMultiplier: 0.55,
  /** 被弾後の無敵時間（秒） */
  invulnerableTime: 0.6,
  /** 自動照準で敵を探す距離（論理px） */
  autoAimRange: 90,
  /** 死亡から復活までの時間（秒） */
  respawnTime: 1.5,
} as const;

/** ダメージ計算 */
export const COMBAT = {
  /** 防御による軽減: dmg * K / (K + def) */
  defenseK: 50,
  /** ダメージの揺らぎ ±割合 */
  variance: 0.1,
  /** 基本会心ダメージ倍率 */
  baseCritMultiplier: 1.5,
  /** ノックバック速度・時間 */
  knockbackSpeed: 140,
  knockbackTime: 0.12,
  /** 被弾時の白フラッシュ時間（秒） */
  hitFlashTime: 0.08,
} as const;

/** 敵 */
export const ENEMY = {
  /** エリアレベルごとの HP / 攻撃力 上昇率 */
  hpPerLevel: 0.25,
  atkPerLevel: 0.18,
  /** 死亡から再出現までの秒数 */
  respawnDelay: 4,
  /** プレイヤーからこれ以上離れた位置に再出現させる */
  respawnMinDistance: 140,
} as const;

/** 経験値・レベル */
export const EXP = {
  /** 次のレベルまでの必要経験値 = base × level ^ exponent */
  base: 20,
  exponent: 1.6,
  maxLevel: 50,
  /** エリアレベル1上がるごとの獲得経験値の増加率 */
  perAreaLevel: 0.3,
} as const;

/** ドロップ・装備 */
export const LOOT = {
  /** 敵1体あたりの装備ドロップ率（敵定義の dropRate を掛ける） */
  dropChance: 0.3,
  /** レアリティの抽選の重み */
  rarityWeights: { normal: 60, magic: 28, rare: 10, legendary: 2 },
  /** レアリティごとの追加効果の数 [最小, 最大] */
  affixCount: { normal: [0, 0], magic: [1, 2], rare: [2, 3], legendary: [4, 4] },
  /** レアリティごとの基本性能の倍率 */
  baseStatMultiplier: { normal: 1, magic: 1.05, rare: 1.12, legendary: 1.3 },
  /** アイテムレベル1上がるごとの基本性能の上昇率 */
  baseStatPerLevel: 0.15,
  /** 今のジョブの武装が出やすくなる確率（武装が選ばれたとき） */
  currentJobWeaponChance: 0.7,
  /** 部位の抽選の重み */
  slotWeights: { weapon: 3, head: 2, body: 2, hands: 2, feet: 2, accessory: 1 },
  /** 売値 = sellBase[レアリティ] × (1 + アイテムレベル × sellPerLevel) */
  sellBase: { normal: 2, magic: 6, rare: 15, legendary: 50 },
  sellPerLevel: 0.2,
  /** 持ち物の上限 */
  inventorySize: 35,
  /** 自動で拾う距離（論理px） */
  pickupRange: 12,
  /** 地面に残せるドロップの上限（超えたら古いノーマルから消える） */
  maxGroundItems: 30,
} as const;

/** 「最強装備」ボタンの評価式
 *  強さ = 火力 × 耐久^defenseWeight × (移動速度/60)^speedWeight
 *  火力 = 攻撃力 × 攻撃速度 × 会心込みの期待倍率 / 耐久 = 最大HP × 防御による軽減
 */
export const AUTO_EQUIP = {
  defenseWeight: 0.5,
  speedWeight: 0.3,
} as const;

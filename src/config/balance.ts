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
  stickRadius: 20,
  /** これ未満の入力は無視 */
  stickDeadZone: 0.15,
  /** 画面のこの割合より下・左半分をスティック領域にする */
  stickAreaTopRatio: 0.4,
  attackButtonRadius: 20,
  skillButtonRadius: 11,
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

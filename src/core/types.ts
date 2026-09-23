// 共通の型定義

export type JobId = 'warrior' | 'mage' | 'hunter';
/** 武装の種類（戦士＝バンパー／魔法使い＝魔導エンジン／狩人＝ボウガン砲台） */
export type WeaponType = 'bumper' | 'engine' | 'turret';

/** 最終ステータス（ジョブ基礎＋Lv成長＋装備で算出） */
export interface Stats {
  maxHp: number;
  atk: number;
  def: number;
  /** 会心率 0〜1 */
  critRate: number;
  /** 会心ダメージ倍率の加算分（0.5 → 基本1.5倍+0.5=2.0倍） */
  critDamage: number;
  /** 移動速度（論理px/秒） */
  moveSpeed: number;
  /** 1秒あたりの通常攻撃回数 */
  attackSpeed: number;
}

export type StatKey = keyof Stats;

/**
 * スキルの種類。種類ごとの処理は systems/SkillRunner.ts
 * - meleeArc: 前方の扇形を攻撃
 * - projectile: 弾を撃つ（複数・拡散・貫通・着弾爆発に対応）
 * - area: 狙った場所を遅れて範囲攻撃（複数回にも対応）
 * - nova: 自分の周囲を範囲攻撃
 * - dash: 向いている方向へ突進し、触れた敵を攻撃
 * - buff: 一定時間ステータスを強化
 */
export type SkillKind = 'meleeArc' | 'projectile' | 'area' | 'nova' | 'dash' | 'buff';

export interface SkillDef {
  id: string;
  name: string;
  /** スキルボタンに出す短い名前（2文字程度） */
  short: string;
  kind: SkillKind;
  /** ダメージ倍率（攻撃力に掛ける） */
  power: number;
  /** クールダウン（秒）。通常攻撃は攻撃速度で決まるので 0 */
  cooldown: number;
  /** エフェクトの色 */
  color?: number;

  /** meleeArc: 射程・扇の角度（度）／ nova・area: 半径 */
  range?: number;
  arc?: number;
  radius?: number;
  /** エフェクトのスプライトキー */
  effect?: string;

  /** projectile: 弾の設定 */
  projectile?: {
    sprite: string;
    speed: number;
    /** 飛ぶ距離 */
    distance: number;
    count?: number;
    /** 複数発の広がり（度） */
    spread?: number;
    /** 貫通できる敵の数 */
    pierce?: number;
    /** 着弾時の爆発半径 */
    explodeRadius?: number;
    /** 当たり判定の半径 */
    hitRadius?: number;
  };

  /** area: 着弾までの時間・回数・散らばり */
  delay?: number;
  strikes?: number;
  scatter?: number;

  /** dash: 速度と時間 */
  dashSpeed?: number;
  dashTime?: number;

  /** buff: 倍率と時間 */
  buff?: { stats: Partial<Record<StatKey, number>>; duration: number };
}

export interface JobDef {
  id: JobId;
  name: string;
  /** ジョブ選択画面の説明 */
  description: string;
  weaponType: WeaponType;
  /** 最初から装備している武装（data/itemBases.ts の id） */
  starterWeapon: string;
  sprite: string;
  base: Stats;
  /** Lv1 から 1 上がるごとの増加量 */
  growth: Partial<Stats>;
  basicAttack: string;
  skills: { id: string; unlockLevel: number }[];
}

export type EnemyAiKind = 'melee';

/**
 * 予兆範囲（AoE）の形。向きは攻撃開始時の敵→プレイヤー方向
 * - circle: 中心から半径 radius（offset だけ前方にずらせる）
 * - cone: 扇形。angle は全体の開き（度）
 * - line: 前方へ長さ length・幅 width の帯
 */
export type AoeShape =
  | { type: 'circle'; radius: number; offset?: number }
  | { type: 'cone'; radius: number; angle: number }
  | { type: 'line'; length: number; width: number };

/** 敵の攻撃 */
export interface EnemyAttackDef {
  shape: AoeShape;
  /** 予兆が出てから判定までの秒数 */
  windup: number;
  /** 攻撃力に掛ける倍率（省略時 1） */
  power?: number;
  /** 判定の瞬間に向きの方向へ飛び出す速さ（体当たり） */
  lunge?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  ai: EnemyAiKind;
  hp: number;
  atk: number;
  def: number;
  moveSpeed: number;
  /** 気づく距離 */
  aggroRange: number;
  /** 攻撃を始める距離 */
  attackRange: number;
  attack: EnemyAttackDef;
  /** 攻撃後の硬直時間（秒） */
  recover: number;
  /** 当たり判定の半径 */
  bodyRadius: number;
  exp: number;
  /** ドロップ率の倍率（省略時 1） */
  dropRate?: number;
}

/** 町の NPC */
export interface NpcDef {
  id: string;
  name: string;
  sprite: string;
  /** マップ上の位置を表す文字（data/maps.ts） */
  marker: string;
  /** 話しかけたときの動作 */
  action: 'jobChange' | 'upgrade' | 'talk';
  /** 話しかけたときのひとこと */
  lines: string[];
}

/** エリア間の出入口 */
export interface ExitDef {
  /** マップ上の文字（門のタイルとして描画される） */
  char: string;
  to: string;
  /** 移動先マップで出現する位置の文字（省略時は '@'） */
  arrive?: string;
}

/** エリア定義（町・フィールド・ボスエリア） */
export interface AreaDef {
  id: string;
  name: string;
  type: 'town' | 'field';
  map: string;
  /** 目印の文字の下に敷く床タイルの文字 */
  floor: string;
  level: number;
  maxEnemies: number;
  enemies: { id: string; weight: number }[];
  exits: ExitDef[];
  npcs?: NpcDef[];
}

// ---------------------------------------------------------------- 装備

export type Rarity = 'normal' | 'magic' | 'rare' | 'legendary';
/** 部位。表示名は data/slots.ts（武装／ヘルメット／装甲／ハンドル／タイヤ／お守り） */
export type Slot = 'weapon' | 'head' | 'body' | 'hands' | 'feet' | 'accessory';
export type ArmorSlot = Exclude<Slot, 'weapon'>;

/** 装備のベース（種類）。data/itemBases.ts */
export interface ItemBaseDef {
  id: string;
  name: string;
  slot: Slot;
  /** 武装のみ：装備できるジョブの武装種 */
  weaponType?: WeaponType;
  icon: string;
  /** Lv1 時点の基本性能。アイテムレベルで伸びる */
  stats: Partial<Stats>;
  /** このアイテムレベル以上でドロップする */
  minLevel: number;
}

/** 追加効果の定義。data/affixes.ts */
export interface AffixDef {
  id: string;
  stat: StatKey;
  /** flat: 足し算 / percent: 掛け算（+x%） */
  mode: 'flat' | 'percent';
  /** アイテムレベル1での値の範囲と、1レベルごとの上昇 */
  min: number;
  max: number;
  perLevel: number;
  slots: Slot[];
  weight: number;
  /** マジック品の名前に付く接頭語 */
  prefix: string;
  /** 指定すると「このスキルの威力 +x%」になる（stat は無視） */
  skill?: string;
}

/** 実際に手に入る装備 */
export interface ItemInstance {
  uid: string;
  baseId: string;
  rarity: Rarity;
  itemLevel: number;
  name: string;
  /** 基本性能（生成時に確定） */
  stats: Partial<Stats>;
  affixes: { id: string; value: number }[];
  /** 強化値（町の整備士で上げる） */
  upgrade: number;
}

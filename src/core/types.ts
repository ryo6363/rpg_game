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

/** スキルの種類。種類ごとの処理は systems/SkillRunner.ts */
export type SkillKind = 'meleeArc';

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  /** ダメージ倍率（攻撃力に掛ける） */
  power: number;
  /** クールダウン（秒）。通常攻撃は攻撃速度で決まるので 0 */
  cooldown: number;
  /** meleeArc: 射程・扇の角度（度） */
  range?: number;
  arc?: number;
  /** エフェクトのスプライトキー */
  effect?: string;
}

export interface JobDef {
  id: JobId;
  name: string;
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
  /** 攻撃の溜め時間・硬直時間（秒） */
  windup: number;
  recover: number;
  /** 当たり判定の半径 */
  bodyRadius: number;
  exp: number;
  /** ドロップ率の倍率（省略時 1） */
  dropRate?: number;
}

/** フィールドのエリア定義 */
export interface AreaDef {
  id: string;
  name: string;
  map: string;
  level: number;
  maxEnemies: number;
  enemies: { id: string; weight: number }[];
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
  /** 強化値（ステップ3） */
  upgrade: number;
}

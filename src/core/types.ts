// 共通の型定義

export type JobId = 'warrior' | 'mage' | 'hunter';
export type WeaponType = 'sword' | 'staff' | 'bow';

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

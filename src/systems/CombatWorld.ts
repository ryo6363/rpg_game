import type Phaser from 'phaser';
import type { AoeEffect, AoeShape } from '../core/types';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

export interface ProjectileSpec {
  x: number;
  y: number;
  angle: number;
  speed: number;
  distance: number;
  sprite: string;
  /** プレイヤーの弾: スキル倍率 / 敵の弾: 攻撃力そのもの */
  power: number;
  pierce?: number;
  hitRadius?: number;
  explodeRadius?: number;
  color?: number;
  /** true なら敵の弾（プレイヤーに当たる） */
  hostile?: boolean;
}

/** 敵の攻撃の予兆範囲 */
export interface AoeSpec {
  /** 範囲の基点と向き（ラジアン） */
  x: number;
  y: number;
  angle: number;
  shape: AoeShape;
  /** 予兆が出てから判定までの秒数 */
  duration: number;
  /** 当たったときの攻撃力 */
  power: number;
  /** 使い手。倒れたら攻撃は中止される */
  owner?: { readonly alive: boolean };
  /** 予兆を出すまでの待ち時間（秒） */
  delay?: number;
  /** 判定の瞬間の演出 */
  effect?: AoeEffect;
  /** この円の中は安全（範囲に入っていても当たらない） */
  holes?: { x: number; y: number; r: number }[];
  /** true なら安全地帯の目印として表示するだけ（ダメージなし） */
  safe?: boolean;
  /** 範囲の外枠が時間とともに広がる（必殺技） */
  grow?: boolean;
}

/** 床に残る危険地帯（炎など）。触れている間 tick 秒ごとにダメージ */
export interface HazardSpec {
  x: number;
  y: number;
  radius: number;
  duration: number;
  power: number;
  tick: number;
}

/** スキルや敵AIがフィールドに対して行える操作（FieldScene / TownScene が実装する） */
export interface CombatWorld {
  gameScene: Phaser.Scene;
  player: Player;
  /** 生存中の敵 */
  getLiveEnemies(): readonly Enemy[];
  damageEnemy(enemy: Enemy, power: number, fromX: number, fromY: number): void;
  /** 範囲内の敵すべてにダメージ。当たった数を返す */
  damageArea(x: number, y: number, radius: number, power: number): number;
  /** dot = 継続ダメージ（無敵時間を発生させない） */
  damagePlayer(rawAtk: number, fromX: number, fromY: number, dot?: boolean): void;
  spawnProjectile(spec: ProjectileSpec): void;
  /** 敵の攻撃の予兆範囲を出す（判定は時間経過で自動） */
  spawnAoe(spec: AoeSpec): void;
  /** 床に残る危険地帯を置く */
  spawnHazard(spec: HazardSpec): void;
  /** 時間停止の演出（画面がモノクロになり、時計盤が出る） */
  timeStopEffect(duration: number, x: number, y: number): void;
  /** ボスが剣を突き立てる演出 */
  swordPlantEffect(x: number, y: number, duration: number): void;
  /** 予兆範囲の判定時の演出（炎など） */
  showAoeEffect(spec: AoeSpec): void;
  /** 爆発などの円形エフェクト */
  showBlast(x: number, y: number, radius: number, color: number): void;
  isWall(x: number, y: number): boolean;
}

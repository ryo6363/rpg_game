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
  /** 1秒あたりに曲がる角度（ラジアン）。渦を巻く弾に使う */
  curve?: number;
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
  /** true なら予兆の表示だけ（ダメージなし。弾の軌道や津波の範囲を見せる） */
  noDamage?: boolean;
  /** 最初の follow 秒は予兆がプレイヤーを追いかける（潜航） */
  follow?: number;
  /** 範囲内のプレイヤーを中心へ引き寄せる強さ（px/秒） */
  pull?: number;
  /** 判定の瞬間、その場所に水エリアを残す */
  leaveWater?: { radius: number; duration: number };
  /** 判定の瞬間に呼ばれる（最終的な位置が渡される） */
  onResolve?: (spec: AoeSpec) => void;
  /** 塗りの色（省略時は赤。輪廻の鎖は紫） */
  color?: number;
}

/** 津波・尻尾の横薙ぎ：エリアを横切る帯。当たるとダメージとノックバック */
export interface SweepSpec {
  axis: 'x' | 'y';
  /** 帯が動き始める位置と終わる位置（axis 方向の座標） */
  from: number;
  to: number;
  /** 帯が横に広がる範囲（axis と直交する方向の座標） */
  spanMin: number;
  spanMax: number;
  /** 帯の厚み・速さ・押し出す強さ */
  band: number;
  speed: number;
  knockback: number;
  power: number;
  /** 通ったあとに水エリアを残す */
  leaveWater?: boolean;
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

  // ---- 第3章：水・ノックバック・回転
  /** 水エリア（移動が遅くなる）を置く */
  spawnWater(x: number, y: number, radius: number, duration: number): void;
  /** その位置での移動速度の倍率（水の中なら小さい） */
  moveMultiplierAt(x: number, y: number): number;
  /** プレイヤーを押し流す（このフレームだけ、速度を足す） */
  pushPlayer(vx: number, vy: number): void;
  /** プレイヤーを吹き飛ばす（time 秒間、操作より優先して動かす） */
  knockPlayer(vx: number, vy: number, time: number): void;
  /** 津波・尻尾の横薙ぎを走らせる */
  startSweep(spec: SweepSpec): void;
  /** 渦の演出（dir: 1 = 時計回り / -1 = 反時計回り） */
  vortexEffect(x: number, y: number, dir: number, duration: number): void;
  /** 頭上に吹き出しの台詞を出す */
  showSpeech(x: number, y: number, text: string): void;
  /** 数字などを浮かび上がらせる（回復量など） */
  showFloat(x: number, y: number, text: string, color: string): void;
  /** 予兆範囲の判定時の演出（炎など） */
  showAoeEffect(spec: AoeSpec): void;
  /** 爆発などの円形エフェクト */
  showBlast(x: number, y: number, radius: number, color: number): void;
  isWall(x: number, y: number): boolean;
}

import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

/** スキルや敵AIがフィールドに対して行える操作（FieldScene が実装する） */
export interface CombatWorld {
  gameScene: Phaser.Scene;
  player: Player;
  /** 生存中の敵 */
  getLiveEnemies(): readonly Enemy[];
  damageEnemy(enemy: Enemy, power: number, fromX: number, fromY: number): void;
  damagePlayer(rawAtk: number, fromX: number, fromY: number): void;
}

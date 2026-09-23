import Phaser from 'phaser';

// シーン間の通知用。イベント名は GameEvents に集約する
export const EventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  /** (hp: number, maxHp: number) */
  PlayerHpChanged: 'player-hp-changed',
  /** () */
  PlayerDied: 'player-died',
  /** (enemyId: string, x: number, y: number) */
  EnemyKilled: 'enemy-killed',
  /** (viewport) 画面サイズ変更 */
  ViewportChanged: 'viewport-changed',
} as const;

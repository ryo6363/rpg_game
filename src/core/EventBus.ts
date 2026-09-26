import Phaser from 'phaser';

// シーン間の通知用。イベント名は GameEvents に集約する
export const EventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  /** (hp: number, maxHp: number) */
  PlayerHpChanged: 'player-hp-changed',
  /** (amount: number) */
  PlayerDamaged: 'player-damaged',
  /** () */
  PlayerDied: 'player-died',
  /** (enemyId: string, x: number, y: number) */
  EnemyKilled: 'enemy-killed',
  /** () 経験値が変わった */
  ExpChanged: 'exp-changed',
  /** (level: number, statPoints: number) 上がったあとのレベルと、もらったステータスポイント */
  LevelUp: 'level-up',
  /** () ステータスポイントを振った */
  StatsChanged: 'stats-changed',
  /** () 回復ボタンが押された（ガソリンを使う） */
  UseGas: 'use-gas',
  /** () ジョブを切り替えた */
  JobChanged: 'job-changed',
  /** () 装備の付け替え・売却 */
  EquipmentChanged: 'equipment-changed',
  /** (item: ItemInstance) 拾った */
  ItemPickedUp: 'item-picked-up',
  /** (text: string, color: string) 画面上部に短いメッセージ */
  Toast: 'toast',
  /** (viewport) 画面サイズ変更 */
  ViewportChanged: 'viewport-changed',
} as const;

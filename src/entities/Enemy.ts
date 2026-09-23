import Phaser from 'phaser';
import { COMBAT, ENEMY } from '../config/balance';
import type { EnemyDef } from '../core/types';
import type { CombatWorld } from '../systems/CombatWorld';
import { ENEMY_AI } from '../systems/EnemyAI';

export type EnemyState = 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'knockback' | 'dead';

/** 敵。死亡後はプールに戻り spawn() で再利用される */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  def!: EnemyDef;
  level = 1;
  hp = 1;
  maxHp = 1;
  atk = 1;
  defense = 0;
  radius = 6;

  state: EnemyState = 'idle';
  stateTimer = 0;
  targetX = 0;
  targetY = 0;
  private hitFlash = 0;
  private shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    super(scene, -100, -100, 'slime', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.shadow = scene.add.image(-100, -100, 'shadow', 0).setAlpha(0.3);
    this.deactivate();
  }

  get alive() {
    return this.active && this.state !== 'dead';
  }

  spawn(def: EnemyDef, x: number, y: number, level: number, difficultyMul = 1) {
    this.def = def;
    this.level = level;
    const lv = level - 1;
    this.maxHp = Math.round(def.hp * (1 + lv * ENEMY.hpPerLevel) * difficultyMul);
    this.hp = this.maxHp;
    this.atk = def.atk * (1 + lv * ENEMY.atkPerLevel) * difficultyMul;
    this.defense = def.def;
    this.radius = def.bodyRadius;

    this.setTexture(def.sprite, 0);
    this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1);
    this.clearTint();
    this.body.enable = true;
    this.body.setCircle(this.radius, 8 - this.radius, 10 - this.radius);
    this.body.setVelocity(0, 0);
    this.shadow.setVisible(true);
    this.anims.play(`${def.sprite}_idle`, true);
    this.anims.setProgress(Math.random());
    this.setEnemyState('idle', Math.random() * 2);
  }

  setEnemyState(state: EnemyState, timer = 0) {
    this.state = state;
    this.stateTimer = timer;
  }

  /** ダメージを受ける。死亡したら true */
  applyDamage(amount: number, fromX: number, fromY: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    this.hitFlash = COMBAT.hitFlashTime;
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    // 溜め中はひるまない（スーパーアーマー）
    if (this.state !== 'windup') {
      const ang = Math.atan2(this.y - fromY, this.x - fromX);
      this.body.setVelocity(Math.cos(ang) * COMBAT.knockbackSpeed, Math.sin(ang) * COMBAT.knockbackSpeed);
      this.setEnemyState('knockback', COMBAT.knockbackTime);
    }
    return false;
  }

  private die() {
    this.setEnemyState('dead');
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setTintFill(0xffffff);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 0.4,
      duration: 220,
      onComplete: () => this.deactivate(),
    });
    this.shadow.setVisible(false);
  }

  deactivate() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.shadow.setVisible(false);
    this.state = 'dead';
  }

  updateEnemy(dt: number, world: CombatWorld) {
    if (!this.alive) return;
    this.stateTimer -= dt;
    this.hitFlash -= dt;

    ENEMY_AI[this.def.ai](this, dt, world);

    // 見た目
    const vx = this.body.velocity.x;
    if (vx < -1) this.setFlipX(true);
    else if (vx > 1) this.setFlipX(false);
    if (this.hitFlash > 0) this.setTintFill(0xffffff);
    else if (this.state === 'windup' && Math.floor(this.stateTimer * 16) % 2 === 0) this.setTint(0xff6060);
    else this.clearTint();
    this.setDepth(this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y) + 6).setDepth(this.y - 1);
  }
}

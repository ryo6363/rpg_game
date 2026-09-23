import Phaser from 'phaser';
import { BOSS, COMBAT, ENEMY } from '../config/balance';
import type { EnemyAttackDef, EnemyDef } from '../core/types';
import type { CombatWorld } from '../systems/CombatWorld';
import { ENEMY_AI } from '../systems/EnemyAI';

export type EnemyState = 'idle' | 'wander' | 'chase' | 'windup' | 'lunge' | 'recover' | 'knockback' | 'dead';

/** 敵（ボスも含む）。死亡後はプールに戻り spawn() で再利用される */
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
  /** 使っている攻撃と、その向き・範囲の基点（予兆を出した時点で固定） */
  currentAttack?: EnemyAttackDef;
  attackAngle = 0;
  aoeX = 0;
  aoeY = 0;
  /** ボス：次の攻撃までの時間と、今のフェーズ（1 始まり） */
  attackCooldown = 0;
  phase = 1;
  /** 連続攻撃の残り回数と、今が何回目か（0 始まり） */
  repeatLeft = 0;
  repeatIndex = 0;
  /** ボス：出現位置（エリアの中心として使う） */
  homeX = 0;
  homeY = 0;
  /** ボス：フェーズが変わって必ず次に使う技 */
  forcedPattern: string | null = null;
  /** ボス：最初に攻撃を受けたか */
  hitOnce = false;
  /** 飛び出し中にプレイヤーに当たったか（1回の突進で1回だけ） */
  lungeHit = false;
  /** 飛び出し中に炎の床を置く間隔 */
  trailTimer = 0;
  /** 飛び出しが終わったときに続けて行う処理（王都崩壊の移動など） */
  afterLunge: (() => void) | null = null;
  private flameTimer = 0;

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

  get isBoss() {
    return !!this.def?.boss;
  }

  spawn(def: EnemyDef, x: number, y: number, level: number) {
    this.def = def;
    this.level = level;
    const lv = level - 1;
    this.maxHp = Math.round(def.hp * (1 + lv * ENEMY.hpPerLevel));
    this.hp = this.maxHp;
    this.atk = def.atk * (1 + lv * ENEMY.atkPerLevel);
    this.defense = def.def + lv * 0.5;
    this.radius = def.bodyRadius;
    this.phase = 1;
    this.attackCooldown = 1;
    this.currentAttack = undefined;
    this.repeatLeft = 0;
    this.repeatIndex = 0;
    this.homeX = x;
    this.homeY = y;
    this.forcedPattern = null;
    this.hitOnce = false;
    this.afterLunge = null;

    this.setTexture(def.sprite, 0);
    this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0);
    this.clearTint();
    this.body.enable = true;
    // 当たり判定は絵の中心より少し下（足元寄り）
    const w = this.frame.width;
    const h = this.frame.height;
    this.body.setCircle(this.radius, w / 2 - this.radius, h * 0.62 - this.radius);
    this.body.setVelocity(0, 0);
    this.body.pushable = !def.heavy;
    this.shadow
      .setTexture(w > 16 ? 'shadow_wide' : 'shadow', 0)
      .setScale(w > 16 ? 1.6 : 1)
      .setVisible(true);
    this.anims.play(`${def.sprite}_idle`, true);
    this.anims.setProgress(Math.random());
    this.setEnemyState('idle', Math.random() * 2);
  }

  setEnemyState(state: EnemyState, timer = 0) {
    this.state = state;
    this.stateTimer = timer;
  }

  /**
   * ダメージを受ける。
   * 戻り値: died = 死亡した / phaseUp = ボスのフェーズが上がった
   */
  applyDamage(amount: number, fromX: number, fromY: number): { died: boolean; phaseUp: boolean } {
    if (!this.alive) return { died: false, phaseUp: false };
    this.hp -= amount;
    this.hitFlash = COMBAT.hitFlashTime;
    if (this.hp <= 0) {
      this.die();
      return { died: true, phaseUp: false };
    }
    // フェーズ判定（ボス）
    let phaseUp = false;
    const phases = this.def.boss?.phases ?? [];
    while (this.phase - 1 < phases.length && this.hp / this.maxHp <= phases[this.phase - 1]) {
      this.phase++;
      phaseUp = true;
      const forced = this.def.boss?.forcedOnPhase?.[this.phase];
      if (forced) this.forcedPattern = forced;
    }
    // 重い敵・攻撃中（溜め・飛び出し）はひるまない
    const busy = this.state === 'windup' || this.state === 'lunge';
    if (!this.def.heavy && !busy) {
      const ang = Math.atan2(this.y - fromY, this.x - fromX);
      this.body.setVelocity(Math.cos(ang) * COMBAT.knockbackSpeed, Math.sin(ang) * COMBAT.knockbackSpeed);
      this.setEnemyState('knockback', COMBAT.knockbackTime);
    }
    return { died: false, phaseUp };
  }

  private die() {
    this.setEnemyState('dead');
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setTintFill(0xffffff);
    this.shadow.setVisible(false);
    if (this.isBoss) {
      // ボスは光りながらゆっくり消える
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleY: 1.3,
        duration: BOSS.deathTime * 1000,
        ease: 'Quad.easeIn',
        onComplete: () => this.deactivate(),
      });
      return;
    }
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 0.4,
      duration: 220,
      onComplete: () => this.deactivate(),
    });
  }

  deactivate() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.shadow.setVisible(false);
    this.state = 'dead';
  }

  private spawnMouthFlame() {
    const dir = this.flipX ? -1 : 1;
    const mx = this.x + dir * this.frame.width * 0.38 + (Math.random() - 0.5) * 4;
    const my = this.y - this.frame.height * 0.05 + (Math.random() - 0.5) * 4;
    const f = this.scene.add.sprite(mx, my, 'fx_flame', 0).setScale(0.6).setDepth(this.y + 1).play('fx_flame_burn');
    this.scene.tweens.add({
      targets: f,
      y: my - 6,
      alpha: 0,
      duration: 260,
      onComplete: () => f.destroy(),
    });
  }

  updateEnemy(dt: number, world: CombatWorld) {
    if (!this.alive) return;
    this.stateTimer -= dt;
    this.hitFlash -= dt;

    ENEMY_AI[this.def.ai](this, dt, world);

    // 見た目（溜め中はプレイヤーの方を向く）
    const vx = this.state === 'windup' ? Math.cos(this.attackAngle) : this.body.velocity.x;
    if (vx < -0.01) this.setFlipX(true);
    else if (vx > 0.01) this.setFlipX(false);
    if (this.hitFlash > 0) this.setTintFill(0xffffff);
    else if (this.state === 'windup' && Math.floor(this.stateTimer * 16) % 2 === 0) this.setTint(0xff6060);
    else this.clearTint();
    // 炎の攻撃の溜め中は、口元に青白い炎がちらつく
    this.flameTimer -= dt;
    if (this.state === 'windup' && this.currentAttack?.effect === 'flame' && this.flameTimer <= 0) {
      this.flameTimer = 0.07;
      this.spawnMouthFlame();
    }
    this.setDepth(this.y);
    const footY = this.frame.height * 0.35;
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y + footY)).setDepth(this.y - 1);
  }
}

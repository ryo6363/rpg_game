import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import type { JobId, SkillDef, Stats } from '../core/types';
import { JOBS } from '../data/jobs';
import { SKILLS } from '../data/skills';
import { InputState } from '../input/InputState';
import type { CombatWorld } from '../systems/CombatWorld';
import { runSkill } from '../systems/SkillRunner';
import { currentStats } from '../systems/Equipment';
import type { Enemy } from './Enemy';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  jobId: JobId = 'warrior';
  stats!: Stats;
  hp = 1;
  dead = false;
  readonly radius = 6;

  private basicAttack!: SkillDef;
  private attackTimer = 0;
  private attackPose = 0;
  private attackAngle = 0;
  private invulnerable = 0;
  private hitFlash = 0;
  /** 最後に移動した方向（敵がいないときの攻撃方向） */
  private faceAngle = -Math.PI / 2;
  private shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'car_warrior', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.shadow = scene.add.image(x, y, 'shadow_wide', 0).setAlpha(0.35);
    this.body.setCircle(this.radius, 8 - this.radius, 12 - this.radius);
    this.body.setCollideWorldBounds(true);
  }

  setJob(jobId: JobId) {
    const job = JOBS[jobId];
    this.jobId = jobId;
    this.stats = currentStats(jobId);
    this.hp = this.stats.maxHp;
    this.basicAttack = SKILLS[job.basicAttack];
    this.setTexture(job.sprite, 0);
  }

  /** 装備・レベルが変わったときにステータスを再計算（HPは割合を保つ） */
  recalcStats(fullHeal = false) {
    const ratio = this.hp / this.stats.maxHp;
    this.stats = currentStats(this.jobId);
    this.hp = fullHeal ? this.stats.maxHp : Math.max(1, Math.round(this.stats.maxHp * ratio));
  }

  get isInvulnerable() {
    return this.invulnerable > 0 || this.dead;
  }

  /** ダメージを受ける。死亡したら true */
  applyDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerable = PLAYER.invulnerableTime;
    this.hitFlash = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
      this.body.setVelocity(0, 0);
      return true;
    }
    return false;
  }

  revive(x: number, y: number) {
    this.dead = false;
    this.hp = this.stats.maxHp;
    this.setPosition(x, y);
    this.setAlpha(1).setAngle(0);
    this.invulnerable = 1.5;
  }

  updatePlayer(dt: number, world: CombatWorld) {
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y) + 6).setDepth(this.y - 1);
    if (this.dead) {
      this.body.setVelocity(0, 0);
      return;
    }

    this.attackTimer -= dt;
    this.attackPose -= dt;
    this.invulnerable -= dt;
    this.hitFlash -= dt;

    // 移動
    const mx = InputState.moveX;
    const my = InputState.moveY;
    const moving = mx !== 0 || my !== 0;
    const speed = this.stats.moveSpeed * (this.attackPose > 0 ? PLAYER.attackMoveMultiplier : 1);
    this.body.setVelocity(mx * speed, my * speed);
    if (moving) this.faceAngle = Math.atan2(my, mx);

    // 通常攻撃（押しっぱなしで連続）
    if (InputState.attackHeld && this.attackTimer <= 0) {
      const target = this.findNearestEnemy(world.getLiveEnemies());
      this.attackAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.faceAngle;
      runSkill({ world, skill: this.basicAttack, x: this.x, y: this.y + 2, angle: this.attackAngle });
      this.attackTimer = 1 / this.stats.attackSpeed;
      this.attackPose = 0.18;
    }

    // 見た目
    const lookX = this.attackPose > 0 ? Math.cos(this.attackAngle) : mx;
    if (lookX < -0.1) this.setFlipX(true);
    else if (lookX > 0.1) this.setFlipX(false);

    if (moving) this.anims.play(`${this.texture.key}_move`, true);
    else {
      this.anims.stop();
      this.setFrame(0);
    }

    if (this.hitFlash > 0) this.setTintFill(0xffffff);
    else this.clearTint();
    // 無敵中は点滅
    this.setAlpha(this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2 === 0 ? 0.5 : 1);
    this.setDepth(this.y);
  }

  private findNearestEnemy(enemies: readonly Enemy[]): Enemy | undefined {
    let best: Enemy | undefined;
    let bestDist: number = PLAYER.autoAimRange;
    for (const e of enemies) {
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }
}

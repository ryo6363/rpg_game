import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import { gameState } from '../core/GameState';
import { HudState } from '../core/HudState';
import type { JobId, SkillDef, StatKey, Stats } from '../core/types';
import { JOBS } from '../data/jobs';
import { SKILLS } from '../data/skills';
import { InputState } from '../input/InputState';
import type { CombatWorld } from '../systems/CombatWorld';
import { currentStats, skillBonuses } from '../systems/Equipment';
import { runSkill } from '../systems/SkillRunner';
import type { Enemy } from './Enemy';

interface Buff {
  stats: Partial<Record<StatKey, number>>;
  remaining: number;
  color: number;
}

interface Dash {
  angle: number;
  speed: number;
  remaining: number;
  power: number;
  radius: number;
  hit: Set<Enemy>;
  color: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  jobId: JobId = 'warrior';
  /** 装備・バフ込みの最終ステータス */
  stats!: Stats;
  hp = 1;
  dead = false;
  /** false なら攻撃・スキルを使わない（町） */
  canAttack = true;
  readonly radius = 6;

  /** 装備込み・バフ抜きのステータス */
  private baseStats!: Stats;
  private basicAttack!: SkillDef;
  private skills: { def: SkillDef; unlockLevel: number; cooldown: number }[] = [];
  private bonuses: Record<string, number> = {};
  private buffs: Buff[] = [];
  private dash: Dash | null = null;
  private trailTimer = 0;

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
    this.basicAttack = SKILLS[job.basicAttack];
    this.skills = job.skills.map((s) => ({ def: SKILLS[s.id], unlockLevel: s.unlockLevel, cooldown: 0 }));
    this.buffs = [];
    this.dash = null;
    this.setTexture(job.sprite, 0);
    this.recalcStats(true);
  }

  /** 装備・レベル・バフが変わったときにステータスを再計算（HPは割合を保つ） */
  recalcStats(fullHeal = false) {
    const ratio = this.stats ? this.hp / this.stats.maxHp : 1;
    this.baseStats = currentStats(this.jobId);
    this.bonuses = skillBonuses(this.jobId);
    const s: Stats = { ...this.baseStats };
    for (const b of this.buffs) {
      for (const [k, mul] of Object.entries(b.stats) as [StatKey, number][]) s[k] *= mul;
    }
    this.stats = s;
    this.hp = fullHeal ? s.maxHp : Math.max(1, Math.round(s.maxHp * ratio));
  }

  get isInvulnerable() {
    return this.invulnerable > 0 || this.dead || this.dash !== null;
  }

  /** ダメージを受ける。死亡したら true */
  applyDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerable = PLAYER.invulnerableTime;
    this.hitFlash = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
      this.dash = null;
      this.body.setVelocity(0, 0);
      return true;
    }
    return false;
  }

  revive(x: number, y: number) {
    this.dead = false;
    this.buffs = [];
    this.recalcStats(true);
    this.setPosition(x, y);
    this.setAlpha(1).setAngle(0);
    this.invulnerable = 1.5;
  }

  // ------------------------------------------------------------ スキルから呼ばれる

  startDash(angle: number, skill: SkillDef, powerMul: number) {
    this.dash = {
      angle,
      speed: skill.dashSpeed ?? 200,
      remaining: skill.dashTime ?? 0.25,
      power: skill.power * powerMul,
      radius: skill.radius ?? 10,
      hit: new Set(),
      color: skill.color ?? 0xffffff,
    };
  }

  addBuff(stats: Partial<Record<StatKey, number>>, duration: number, color: number) {
    this.buffs.push({ stats, remaining: duration, color });
    this.recalcStats();
  }

  // ------------------------------------------------------------ 毎フレーム

  updatePlayer(dt: number, world: CombatWorld) {
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y) + 6).setDepth(this.y - 1);
    this.updateHud();
    if (this.dead) {
      this.body.setVelocity(0, 0);
      return;
    }

    this.attackTimer -= dt;
    this.attackPose -= dt;
    this.invulnerable -= dt;
    this.hitFlash -= dt;
    for (const s of this.skills) s.cooldown = Math.max(0, s.cooldown - dt);
    this.updateBuffs(dt);

    const mx = InputState.moveX;
    const my = InputState.moveY;
    const moving = mx !== 0 || my !== 0;
    if (moving) this.faceAngle = Math.atan2(my, mx);

    if (this.dash) {
      this.updateDash(dt, world);
    } else {
      const speed = this.stats.moveSpeed * (this.attackPose > 0 ? PLAYER.attackMoveMultiplier : 1);
      this.body.setVelocity(mx * speed, my * speed);
      if (this.canAttack) {
        this.updateAttack(world);
        this.updateSkills(world);
      }
    }

    // 見た目
    const lookX = this.dash ? Math.cos(this.dash.angle) : this.attackPose > 0 ? Math.cos(this.attackAngle) : mx;
    if (lookX < -0.1) this.setFlipX(true);
    else if (lookX > 0.1) this.setFlipX(false);

    if (moving || this.dash) this.anims.play(`${this.texture.key}_move`, true);
    else {
      this.anims.stop();
      this.setFrame(0);
    }

    this.trailTimer -= dt;
    const trailColor = this.dash?.color ?? this.buffs[0]?.color;
    if (trailColor !== undefined && this.trailTimer <= 0) {
      this.trailTimer = this.dash ? 0.03 : 0.12;
      this.spawnTrail(trailColor);
    }

    if (this.hitFlash > 0) this.setTintFill(0xffffff);
    else this.clearTint();
    // 無敵中は点滅
    this.setAlpha(this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2 === 0 ? 0.5 : 1);
    this.setDepth(this.y);
  }

  /** 通常攻撃（押しっぱなしで連続） */
  private updateAttack(world: CombatWorld) {
    if (!InputState.attackHeld || this.attackTimer > 0) return;
    const target = this.aimTarget(world, this.basicAttack);
    this.attackAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.faceAngle;
    this.cast(world, this.basicAttack, target);
    this.attackTimer = 1 / this.stats.attackSpeed;
    this.attackPose = 0.18;
  }

  private updateSkills(world: CombatWorld) {
    const level = gameState.jobs[this.jobId].level;
    let index: number | undefined;
    while ((index = InputState.consumeSkill()) !== undefined) {
      const slot = this.skills[index];
      if (!slot || level < slot.unlockLevel || slot.cooldown > 0) continue;
      const target = this.aimTarget(world, slot.def);
      this.attackAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.faceAngle;
      // 突進だけは狙いより入力方向を優先
      if (slot.def.kind === 'dash' && (InputState.moveX || InputState.moveY)) this.attackAngle = this.faceAngle;
      this.cast(world, slot.def, target);
      slot.cooldown = slot.def.cooldown;
      this.attackPose = 0.2;
    }
  }

  private cast(world: CombatWorld, skill: SkillDef, target?: Enemy) {
    runSkill({
      world,
      skill,
      x: this.x,
      y: this.y + 2,
      angle: this.attackAngle,
      powerMul: 1 + (this.bonuses[skill.id] ?? 0),
      targetX: target?.x,
      targetY: target?.y,
    });
  }

  private updateDash(dt: number, world: CombatWorld) {
    const d = this.dash!;
    this.body.setVelocity(Math.cos(d.angle) * d.speed, Math.sin(d.angle) * d.speed);
    for (const e of world.getLiveEnemies()) {
      if (d.hit.has(e)) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= d.radius + e.radius) {
        d.hit.add(e);
        world.damageEnemy(e, d.power, this.x, this.y);
      }
    }
    d.remaining -= dt;
    if (d.remaining <= 0) {
      this.dash = null;
      this.body.setVelocity(0, 0);
    }
  }

  private updateBuffs(dt: number) {
    if (this.buffs.length === 0) return;
    const before = this.buffs.length;
    for (const b of this.buffs) b.remaining -= dt;
    this.buffs = this.buffs.filter((b) => b.remaining > 0);
    if (this.buffs.length !== before) this.recalcStats();
  }

  /** 突進・強化中の残像 */
  private spawnTrail(color: number) {
    const ghost = this.scene.add
      .image(this.x, this.y, this.texture.key, this.frame.name)
      .setFlipX(this.flipX)
      .setTintFill(color)
      .setAlpha(0.5)
      .setDepth(this.y - 0.5);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  /** 狙う敵（射程は弾なら飛距離、それ以外は自動照準距離） */
  private aimTarget(world: CombatWorld, skill: SkillDef): Enemy | undefined {
    const range = skill.projectile ? skill.projectile.distance : PLAYER.autoAimRange;
    let best: Enemy | undefined;
    let bestDist = range;
    for (const e of world.getLiveEnemies()) {
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private updateHud() {
    const level = gameState.jobs[this.jobId].level;
    HudState.skills = this.skills.map((s) => ({
      short: s.def.short,
      unlocked: level >= s.unlockLevel,
      unlockLevel: s.unlockLevel,
      cooldown: s.def.cooldown > 0 ? s.cooldown / s.def.cooldown : 0,
    }));
  }
}

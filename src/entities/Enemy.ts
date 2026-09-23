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
  /** 見えない（潜航・透明化）。狙えず、攻撃も当たらない */
  hidden = false;
  /** 渦の回る向き（毎回反対にする） */
  vortexDir = 1;
  /** 台詞を出したか（最初の一撃・HP半分） */
  barked = { hit: false, half: false };
  /** 普通の攻撃を何回使ったか（altAttack の切り替え用） */
  attackCount = 0;
  /** 受けたダメージの記録（時間逆行で使う） */
  private damageLog: { t: number; amount: number }[] = [];
  /** 背後の時計盤など */
  private aura: Phaser.GameObjects.Graphics | null = null;
  private auraTime = 0;
  private blinkTimer = 0;
  private blinkLeft = 0;
  private guardUsed = false;
  private guardLeft = 0;
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
    this.hidden = false;
    this.vortexDir = 1;
    this.barked = { hit: false, half: false };
    this.blinkTimer = def.blink ? def.blink.every * (0.5 + Math.random() * 0.5) : 0;
    this.blinkLeft = 0;
    this.guardUsed = false;
    this.guardLeft = 0;
    this.attackCount = 0;
    this.damageLog = [];
    this.aura?.destroy();
    this.aura = def.aura ? this.scene.add.graphics() : null;

    this.setTexture(def.sprite, 0);
    this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0);
    this.resetTint();
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

  /** 見えなくする／戻す（潜航・透明化） */
  setHidden(hidden: boolean, alpha = 0) {
    this.hidden = hidden;
    this.body.enable = !hidden;
    this.shadow.setVisible(!hidden);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, alpha: hidden ? alpha : 1, duration: 200 });
  }

  /** 防御姿勢中なら受けるダメージの倍率（1 = そのまま） */
  get damageMultiplier(): number {
    return this.guardLeft > 0 ? 1 - (this.def.guard?.reduction ?? 0) : 1;
  }

  get guarding(): boolean {
    return this.guardLeft > 0;
  }

  /** 元の色に戻す（強化版の敵は色味つき） */
  private resetTint() {
    if (this.def.tint) this.setTint(this.def.tint);
    else this.clearTint();
  }

  /** 直前 window 秒に受けたダメージの合計 */
  recentDamage(window: number): number {
    const since = this.scene.time.now - window * 1000;
    return this.damageLog.filter((d) => d.t >= since).reduce((sum, d) => sum + d.amount, 0);
  }

  /** 回復（最大 HP まで） */
  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.damageLog = [];
    return Math.round(this.hp - before);
  }

  setEnemyState(state: EnemyState, timer = 0) {
    this.state = state;
    this.stateTimer = timer;
  }

  /**
   * ダメージを受ける。
   * 戻り値: died = 死亡した / phaseUp = ボスのフェーズが上がった
   */
  applyDamage(amount: number, fromX: number, fromY: number): { died: boolean; phaseUp: boolean; guardStarted: boolean } {
    if (!this.alive || this.hidden) return { died: false, phaseUp: false, guardStarted: false };
    this.hp -= amount;
    this.hitFlash = COMBAT.hitFlashTime;
    if (this.def.boss) {
      this.damageLog.push({ t: this.scene.time.now, amount });
      if (this.damageLog.length > 200) this.damageLog.shift();
    }
    if (this.hp <= 0) {
      this.die();
      return { died: true, phaseUp: false, guardStarted: false };
    }
    // HP が減ると一度だけ防御姿勢
    let guardStarted = false;
    const guard = this.def.guard;
    if (guard && !this.guardUsed && this.hp / this.maxHp <= guard.hpRatio) {
      this.guardUsed = true;
      this.guardLeft = guard.duration;
      guardStarted = true;
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
    return { died: false, phaseUp, guardStarted };
  }

  private die() {
    if (this.aura) this.scene.tweens.add({ targets: this.aura, alpha: 0, duration: 600 });
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
    this.aura?.destroy();
    this.aura = null;
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

    // 一定間隔で透明化（攻撃の溜め中は透明にならない）
    const blink = this.def.blink;
    if (blink) {
      if (this.blinkLeft > 0) {
        this.blinkLeft -= dt;
        if (this.blinkLeft <= 0) this.setHidden(false);
      } else if (this.state !== 'windup' && this.state !== 'lunge') {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
          this.blinkTimer = blink.every;
          this.blinkLeft = blink.duration;
          this.setHidden(true, 0.15);
        }
      }
    }
    this.guardLeft -= dt;

    ENEMY_AI[this.def.ai](this, dt, world);

    // 見た目（溜め中はプレイヤーの方を向く）
    const vx = this.state === 'windup' ? Math.cos(this.attackAngle) : this.body.velocity.x;
    if (vx < -0.01) this.setFlipX(true);
    else if (vx > 0.01) this.setFlipX(false);
    if (this.hitFlash > 0) this.setTintFill(0xffffff);
    else if (this.state === 'windup' && Math.floor(this.stateTimer * 16) % 2 === 0) this.setTint(0xff6060);
    else if (this.guardLeft > 0) this.setTint(0x73eff7);
    else this.resetTint();
    // 炎の攻撃の溜め中は、口元に青白い炎がちらつく
    this.flameTimer -= dt;
    if (this.state === 'windup' && this.currentAttack?.effect === 'flame' && this.flameTimer <= 0) {
      this.flameTimer = 0.07;
      this.spawnMouthFlame();
    }
    this.setDepth(this.y);
    let footY = this.frame.height * 0.35;
    if (this.def.hover) {
      // 飛んでいる：影を下に離し、影の大きさで上下の揺れを見せる
      this.auraTime += dt;
      footY += 10 + Math.sin(this.auraTime * 4) * 2;
      this.shadow.setScale(0.8 + Math.sin(this.auraTime * 4) * 0.1);
    }
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y + footY)).setDepth(this.y - 1);
    if (this.aura) this.drawClockAura(dt);
  }

  /** 背後で回る時計盤と、まわりを漂う光の粒 */
  private drawClockAura(dt: number) {
    const g = this.aura!;
    this.auraTime += dt;
    const t = this.auraTime;
    const cx = this.x;
    const cy = this.y - 8;
    const R = 24;
    g.clear().setDepth(this.y - 2).setAlpha(this.alpha * 0.8);
    g.lineStyle(1, 0xffcd75, 0.7).strokeCircle(cx, cy, R);
    g.lineStyle(1, 0xffcd75, 0.35).strokeCircle(cx, cy, R - 3);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = i % 3 === 0 ? R - 5 : R - 3;
      g.lineStyle(1, 0xffcd75, 0.7).lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }
    // 長針と短針
    const long = t * 1.2;
    const short = t * 0.3;
    g.lineStyle(1, 0xf4f4f4, 0.8).lineBetween(cx, cy, cx + Math.cos(long) * (R - 6), cy + Math.sin(long) * (R - 6));
    g.lineStyle(2, 0xf4f4f4, 0.8).lineBetween(cx, cy, cx + Math.cos(short) * (R - 12), cy + Math.sin(short) * (R - 12));
    // 漂う光の粒と、小さな時計の針
    for (let i = 0; i < 8; i++) {
      const a = t * 0.5 + (i / 8) * Math.PI * 2;
      const r = R + 6 + Math.sin(t * 2 + i) * 4;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.6;
      if (i % 3 === 0) {
        const ha = t * 2 + i;
        g.lineStyle(1, 0xffcd75, 0.8).lineBetween(px, py, px + Math.cos(ha) * 4, py + Math.sin(ha) * 4);
      } else g.fillStyle(0xffcd75, 0.5 + Math.sin(t * 3 + i) * 0.3).fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
}

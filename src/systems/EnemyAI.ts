import type { BossPatternDef, EnemyAiKind, EnemyAttackDef } from '../core/types';
import type { Enemy } from '../entities/Enemy';
import { weightedPick } from './Items';
import type { CombatWorld } from './CombatWorld';

// 敵AI。種類を増やすときはここに関数を追加し、ENEMY_AI に登録する

type AiHandler = (e: Enemy, dt: number, world: CombatWorld) => void;

function moveToward(e: Enemy, x: number, y: number, speed: number) {
  const ang = Math.atan2(y - e.y, x - e.x);
  e.body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
}

/** 攻撃開始：プレイヤーの方向を向き、予兆範囲を出して溜めに入る */
function startAttack(e: Enemy, world: CombatWorld, atk: EnemyAttackDef) {
  const p = world.player;
  e.currentAttack = atk;
  e.attackAngle = Math.atan2(p.y - e.y, p.x - e.x);
  const atTarget = atk.at === 'target';
  e.aoeX = atTarget ? p.x : e.x;
  e.aoeY = atTarget ? p.y : e.y;
  e.body.setVelocity(0, 0);
  const power = e.atk * (atk.power ?? 1);

  const scatter = (atk as BossPatternDef).scatter;
  if (scatter) {
    // プレイヤーの周りに円を時間差で次々と出す（1個目は足元）
    for (let i = 0; i < scatter.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = i === 0 ? 0 : scatter.radius * (0.3 + Math.random() * 0.7);
      world.spawnAoe({
        x: p.x + Math.cos(ang) * d,
        y: p.y + Math.sin(ang) * d,
        angle: 0,
        shape: atk.shape,
        duration: atk.windup,
        delay: i * scatter.interval,
        power,
        owner: e,
        effect: atk.effect,
      });
    }
    e.setEnemyState('windup', atk.windup + (scatter.count - 1) * scatter.interval);
    return;
  }

  e.setEnemyState('windup', atk.windup);
  world.spawnAoe({
    x: e.aoeX,
    y: e.aoeY,
    angle: e.attackAngle,
    shape: atk.shape,
    duration: atk.windup,
    power,
    owner: e,
    effect: atk.effect,
  });
}

/**
 * 攻撃中（溜め → 飛び出し → 硬直）の共通処理。攻撃中なら true
 * 判定そのものは予兆範囲（AoeManager）が行う
 */
function updateAttack(e: Enemy, world: CombatWorld): boolean {
  const atk = e.currentAttack;
  switch (e.state) {
    case 'windup': {
      e.body.setVelocity(0, 0);
      if (e.stateTimer > 0) return true;
      const pattern = atk as BossPatternDef | undefined;
      if (pattern?.leap) {
        // 範囲の中心へ跳ぶ
        const t = pattern.leapTime ?? 0.2;
        const dist = Math.hypot(e.aoeX - e.x, e.aoeY - e.y);
        const ang = Math.atan2(e.aoeY - e.y, e.aoeX - e.x);
        e.body.setVelocity((Math.cos(ang) * dist) / t, (Math.sin(ang) * dist) / t);
        e.setEnemyState('lunge', t);
      } else if (atk?.lunge) {
        e.body.setVelocity(Math.cos(e.attackAngle) * atk.lunge, Math.sin(e.attackAngle) * atk.lunge);
        e.setEnemyState('lunge', atk.lungeTime ?? 0.12);
      } else {
        e.setEnemyState('recover', (pattern?.recover ?? e.def.recover));
      }
      return true;
    }
    case 'lunge':
      if (e.stateTimer <= 0) {
        e.body.setVelocity(0, 0);
        e.setEnemyState('recover', (atk as BossPatternDef | undefined)?.recover ?? e.def.recover);
      }
      return true;
    case 'recover':
      e.body.velocity.scale(0.8);
      if (e.stateTimer <= 0) {
        // 連続攻撃なら狙い直してもう一度
        if (e.repeatLeft > 0 && atk) {
          e.repeatLeft--;
          startAttack(e, world, atk);
        } else e.setEnemyState('chase');
      }
      return true;
    case 'knockback':
      e.body.velocity.scale(0.9);
      if (e.stateTimer <= 0) e.setEnemyState('chase');
      return true;
    default:
      return false;
  }
}

/**
 * 近接型：うろつく → 気づいたら追跡 → 予兆を出して攻撃。
 * 移動速度 0 なら動かない固定砲台（攻撃の at を target にすると足元を狙う）
 */
const melee: AiHandler = (e, _dt, world) => {
  if (updateAttack(e, world)) return;
  const p = world.player;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  const def = e.def;
  const canSee = !p.dead && dist < def.aggroRange;

  switch (e.state) {
    case 'idle':
      e.body.setVelocity(0, 0);
      if (canSee) e.setEnemyState('chase');
      else if (e.stateTimer <= 0) {
        e.targetX = e.x + (Math.random() * 2 - 1) * 40;
        e.targetY = e.y + (Math.random() * 2 - 1) * 40;
        e.setEnemyState('wander', 1 + Math.random() * 1.5);
      }
      break;

    case 'wander':
      if (canSee) e.setEnemyState('chase');
      else if (e.stateTimer <= 0 || Math.hypot(e.targetX - e.x, e.targetY - e.y) < 3) {
        e.setEnemyState('idle', 1 + Math.random() * 2);
      } else moveToward(e, e.targetX, e.targetY, def.moveSpeed * 0.5);
      break;

    case 'chase':
      if (p.dead || dist > def.aggroRange * 1.8) {
        e.setEnemyState('idle', 1);
      } else if (dist <= def.attackRange + p.radius + e.radius) {
        startAttack(e, world, def.attack);
      } else if (def.moveSpeed > 0) moveToward(e, p.x, p.y, def.moveSpeed);
      else e.body.setVelocity(0, 0);
      break;
  }
};

/** ボス：近づきながら、距離とフェーズに合う攻撃パターンを選んで使う */
const boss: AiHandler = (e, dt, world) => {
  if (updateAttack(e, world)) return;
  const p = world.player;
  const b = e.def.boss!;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  e.attackCooldown -= dt;

  if (p.dead) {
    e.body.setVelocity(0, 0);
    return;
  }
  if (e.state !== 'chase') e.setEnemyState('chase');

  if (e.attackCooldown <= 0) {
    const usable = b.patterns.filter((pt) => dist <= pt.range + p.radius + e.radius && e.phase >= (pt.minPhase ?? 1));
    const pattern = weightedPick(usable, (pt) => pt.weight);
    if (pattern) {
      e.repeatLeft = (pattern.repeat ?? 1) - 1;
      startAttack(e, world, pattern);
      e.attackCooldown = b.interval;
      return;
    }
  }
  // 近すぎなければ寄っていく
  if (dist > e.radius + p.radius + 10) moveToward(e, p.x, p.y, e.def.moveSpeed);
  else e.body.setVelocity(0, 0);
};

export const ENEMY_AI: Record<EnemyAiKind, AiHandler> = {
  melee,
  boss,
};

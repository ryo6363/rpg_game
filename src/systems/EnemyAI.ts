import type { EnemyAiKind } from '../core/types';
import type { Enemy } from '../entities/Enemy';
import type { CombatWorld } from './CombatWorld';

// 敵AI。種類を増やすときはここに関数を追加し、ENEMY_AI に登録する

type AiHandler = (e: Enemy, dt: number, world: CombatWorld) => void;

function moveToward(e: Enemy, x: number, y: number, speed: number) {
  const ang = Math.atan2(y - e.y, x - e.x);
  e.body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
}

/** 攻撃開始：プレイヤーの方向を向き、予兆範囲を出して溜めに入る */
function startAttack(e: Enemy, world: CombatWorld) {
  const atk = e.def.attack;
  const p = world.player;
  e.attackAngle = Math.atan2(p.y - e.y, p.x - e.x);
  e.body.setVelocity(0, 0);
  e.setEnemyState('windup', atk.windup);
  world.spawnAoe({
    x: e.x,
    y: e.y,
    angle: e.attackAngle,
    shape: atk.shape,
    duration: atk.windup,
    power: e.atk * (atk.power ?? 1),
    owner: e,
  });
}

/** 近接型：うろつく → 気づいたら追跡 → 溜めてから体当たり */
const melee: AiHandler = (e, _dt, world) => {
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
        startAttack(e, world);
      } else moveToward(e, p.x, p.y, def.moveSpeed);
      break;

    case 'windup':
      // 予兆中は動かない。判定そのものは予兆範囲（AoeManager）が行う
      e.body.setVelocity(0, 0);
      if (e.stateTimer <= 0) {
        const lunge = def.attack.lunge ?? 0;
        if (lunge > 0) e.body.setVelocity(Math.cos(e.attackAngle) * lunge, Math.sin(e.attackAngle) * lunge);
        e.setEnemyState('recover', def.recover);
      }
      break;

    case 'recover':
      e.body.velocity.scale(0.85);
      if (e.stateTimer <= 0) e.setEnemyState('chase');
      break;

    case 'knockback':
      e.body.velocity.scale(0.9);
      if (e.stateTimer <= 0) e.setEnemyState('chase');
      break;

    case 'dead':
      break;
  }
};

export const ENEMY_AI: Record<EnemyAiKind, AiHandler> = {
  melee,
};

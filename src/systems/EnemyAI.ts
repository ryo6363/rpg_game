import type { EnemyAiKind } from '../core/types';
import type { Enemy } from '../entities/Enemy';
import type { CombatWorld } from './CombatWorld';

// 敵AI。種類を増やすときはここに関数を追加し、ENEMY_AI に登録する

type AiHandler = (e: Enemy, dt: number, world: CombatWorld) => void;

function moveToward(e: Enemy, x: number, y: number, speed: number) {
  const ang = Math.atan2(y - e.y, x - e.x);
  e.body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
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
        e.body.setVelocity(0, 0);
        e.setEnemyState('windup', def.windup);
      } else moveToward(e, p.x, p.y, def.moveSpeed);
      break;

    case 'windup':
      e.body.setVelocity(0, 0);
      if (e.stateTimer <= 0) {
        // 体当たり
        moveToward(e, p.x, p.y, 110);
        if (dist <= def.attackRange + p.radius + e.radius + 6) {
          world.damagePlayer(e.atk, e.x, e.y);
        }
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

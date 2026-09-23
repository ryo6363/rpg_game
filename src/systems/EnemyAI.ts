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

/** 連続攻撃の何回目かを考えた溜め時間 */
function windupOf(e: Enemy, atk: EnemyAttackDef): number {
  return atk.repeatWindups?.[e.repeatIndex] ?? atk.windup;
}

/** 攻撃開始：プレイヤーの方向を向き、予兆範囲を出して溜めに入る */
function startAttack(e: Enemy, world: CombatWorld, atk: EnemyAttackDef) {
  const p = world.player;
  e.currentAttack = atk;
  e.attackAngle = Math.atan2(p.y - e.y, p.x - e.x);
  e.lungeHit = false;
  const atTarget = atk.at === 'target';
  e.aoeX = atTarget ? p.x : e.x;
  e.aoeY = atTarget ? p.y : e.y;
  e.body.setVelocity(0, 0);
  const power = e.atk * (atk.power ?? 1);
  const windup = windupOf(e, atk);

  if (atk.special) {
    SPECIALS[atk.special](e, world, atk, power, windup);
    return;
  }

  const scatter = atk.scatter;
  if (scatter) {
    const arena = scatter.around === 'arena';
    const cx = arena ? e.homeX : p.x;
    const cy = arena ? e.homeY : p.y;
    for (let i = 0; i < scatter.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      // エリア全体なら一様に散らす。プレイヤー周りなら1個目は足元
      const d = arena ? Math.sqrt(Math.random()) * scatter.radius : i === 0 ? 0 : scatter.radius * (0.3 + Math.random() * 0.7);
      world.spawnAoe({
        x: cx + Math.cos(ang) * d,
        y: cy + Math.sin(ang) * d,
        angle: 0,
        shape: atk.shape,
        duration: windup,
        delay: i * scatter.interval,
        power,
        owner: e,
        effect: atk.effect,
      });
    }
    e.setEnemyState('windup', windup + (scatter.count - 1) * scatter.interval);
    return;
  }

  // 十字斬は縦横（向きに関係なく）
  const angle = atk.shape.type === 'cross' ? 0 : e.attackAngle;
  e.setEnemyState('windup', windup);
  world.spawnAoe({ x: e.aoeX, y: e.aoeY, angle, shape: atk.shape, duration: windup, power, owner: e, effect: atk.effect });
}

// ---------------------------------------------------------------- 特殊な攻撃

type SpecialHandler = (e: Enemy, world: CombatWorld, atk: EnemyAttackDef, power: number, windup: number) => void;

const SPECIALS: Record<NonNullable<EnemyAttackDef['special']>, SpecialHandler> = {
  /**
   * 王都崩壊：エリア中央へ移動してから、エリア一面に大きな円を並べる。
   * 安全地帯を1〜2か所だけ残し、すべて同時に爆発
   */
  arenaCollapse: (e, world, atk, power, windup) => {
    const place = () => {
      e.body.setVelocity(0, 0);
      const R = atk.arenaRadius ?? 100;
      const r = atk.shape.type === 'circle' ? atk.shape.radius : 30;
      const safeR = 14;
      // 安全地帯：中央から離れた場所にランダム
      const spots: { x: number; y: number; r: number }[] = [];
      const count = atk.safeSpots ?? 1 + Math.round(Math.random());
      for (let i = 0; i < count; i++) {
        // 壁やがれきの上にならない場所を選ぶ
        for (let tries = 0; tries < 30; tries++) {
          const a = Math.random() * Math.PI * 2 + i * Math.PI;
          const d = R * (0.3 + Math.random() * 0.45);
          const x = e.homeX + Math.cos(a) * d;
          const y = e.homeY + Math.sin(a) * d;
          if (!world.isWall(x, y) || tries === 29) {
            spots.push({ x, y, r: safeR });
            break;
          }
        }
      }
      // エリア全体を隙間なく円で覆う（格子の間隔が半径の√2倍以下なら隙間はできない）。
      // 安全地帯の中だけは当たらない（holes）
      const step = r * 1.3;
      let n = 0;
      for (let gx = -R; gx <= R; gx += step) {
        for (let gy = -R; gy <= R; gy += step) {
          if (Math.hypot(gx, gy) > R + r * 0.5) continue;
          const x = e.homeX + gx;
          const y = e.homeY + gy;
          // 落下の演出は3つに1つだけ（重なりすぎて見づらく・重くなるのを防ぐ）
          const effect = n++ % 3 === 0 ? atk.effect : undefined;
          world.spawnAoe({ x, y, angle: 0, shape: atk.shape, duration: windup, power, owner: e, effect, holes: spots });
        }
      }
      for (const s of spots) {
        world.spawnAoe({ x: s.x, y: s.y, angle: 0, shape: { type: 'circle', radius: s.r }, duration: windup, power: 0, safe: true, owner: e });
      }
      e.setEnemyState('windup', windup);
    };
    // まず中央へ（遠ければ素早く移動）
    const dist = Math.hypot(e.homeX - e.x, e.homeY - e.y);
    if (dist < 6) return place();
    const t = 0.35;
    moveToward(e, e.homeX, e.homeY, dist / t);
    e.afterLunge = place;
    e.setEnemyState('lunge', t);
  },

  /** 時葬：画面がモノクロになり、プレイヤーの足元に時計盤つきの円。動いて避けられる */
  timeStop: (e, world, atk, power, windup) => {
    const p = world.player;
    world.timeStopEffect(windup, p.x, p.y);
    world.spawnAoe({ x: p.x, y: p.y, angle: 0, shape: atk.shape, duration: windup, power, owner: e, effect: atk.effect });
    e.setEnemyState('windup', windup);
  },

  /**
   * 輪廻断絶：剣を地面に突き立て、自分を中心に巨大な円がじわじわ広がる。
   * 真横に小さな安全地帯だけが残る
   */
  finale: (e, world, atk, power, windup) => {
    world.swordPlantEffect(e.x, e.y, windup);
    const side = Math.random() < 0.5 ? -1 : 1;
    const hole = { x: e.x + side * (e.radius + 18), y: e.y + 4, r: 12 };
    world.spawnAoe({ x: e.x, y: e.y, angle: 0, shape: atk.shape, duration: windup, power, owner: e, effect: atk.effect, holes: [hole], grow: true });
    world.spawnAoe({ x: hole.x, y: hole.y, angle: 0, shape: { type: 'circle', radius: hole.r }, duration: windup, power: 0, safe: true, owner: e });
    e.setEnemyState('windup', windup);
  },
};

/**
 * 攻撃中（溜め → 飛び出し → 硬直）の共通処理。攻撃中なら true
 * 判定そのものは予兆範囲（AoeManager）が行う
 */
function updateAttack(e: Enemy, dt: number, world: CombatWorld): boolean {
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
        e.setEnemyState('recover', atk?.recover ?? e.def.recover);
      }
      return true;
    }
    case 'lunge': {
      const p = world.player;
      // 突進そのものの当たり判定
      if (atk?.contact && !e.lungeHit && Math.hypot(p.x - e.x, p.y - e.y) <= e.radius + p.radius + 2) {
        e.lungeHit = true;
        world.damagePlayer(e.atk * atk.contact, e.x, e.y);
      }
      // 軌跡に炎の床
      if (atk?.trail) {
        e.trailTimer -= dt;
        if (e.trailTimer <= 0) {
          e.trailTimer = 0.04;
          const t = atk.trail;
          world.spawnHazard({ x: e.x, y: e.y + 4, radius: t.radius, duration: t.duration, power: e.atk * t.power, tick: t.tick });
        }
      }
      if (e.stateTimer <= 0) {
        e.body.setVelocity(0, 0);
        if (e.afterLunge) {
          const next = e.afterLunge;
          e.afterLunge = null;
          next();
        } else e.setEnemyState('recover', atk?.recover ?? e.def.recover);
      }
      return true;
    }
    case 'recover':
      e.body.velocity.scale(0.8);
      if (e.stateTimer <= 0) {
        // 連続攻撃なら狙い直してもう一度
        if (e.repeatLeft > 0 && atk) {
          e.repeatLeft--;
          e.repeatIndex++;
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

/** 攻撃を選んで始める（連続攻撃の回数も設定） */
function beginAttack(e: Enemy, world: CombatWorld, atk: EnemyAttackDef) {
  e.repeatLeft = (atk.repeat ?? 1) - 1;
  e.repeatIndex = 0;
  startAttack(e, world, atk);
}

/**
 * 近接型：うろつく → 気づいたら追跡 → 予兆を出して攻撃。
 * 移動速度 0 なら動かない固定砲台（攻撃の at を target にすると足元を狙う）
 */
const melee: AiHandler = (e, dt, world) => {
  if (updateAttack(e, dt, world)) return;
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
        beginAttack(e, world, def.attack);
      } else if (def.moveSpeed > 0) moveToward(e, p.x, p.y, def.moveSpeed);
      else e.body.setVelocity(0, 0);
      break;
  }
};

/** ボス：近づきながら、距離とフェーズに合う攻撃パターンを選んで使う */
const boss: AiHandler = (e, dt, world) => {
  if (updateAttack(e, dt, world)) return;
  const p = world.player;
  const b = e.def.boss!;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  e.attackCooldown -= dt;

  if (p.dead) {
    e.body.setVelocity(0, 0);
    return;
  }
  if (e.state !== 'chase') e.setEnemyState('chase');

  // フェーズが変わったときの必殺技は、距離や間隔に関係なく最優先
  if (e.forcedPattern) {
    const forced = b.patterns.find((pt) => pt.id === e.forcedPattern);
    e.forcedPattern = null;
    if (forced) {
      beginAttack(e, world, forced);
      e.attackCooldown = b.interval;
      return;
    }
  }

  if (e.attackCooldown <= 0) {
    const usable = b.patterns.filter((pt) => dist <= pt.range + p.radius + e.radius && e.phase >= (pt.minPhase ?? 1));
    const pattern = weightedPick(usable, (pt) => pt.weight);
    if (pattern) {
      beginAttack(e, world, pattern);
      e.attackCooldown = b.interval * (b.intervalByPhase?.[e.phase - 1] ?? 1);
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

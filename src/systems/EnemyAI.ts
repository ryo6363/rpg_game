import Phaser from 'phaser';
import type { EnemyAiKind, EnemyAttackDef } from '../core/types';
import { ENEMIES } from '../data/enemies';
import type { Enemy } from '../entities/Enemy';
import { ENEMY, LOOP } from '../config/balance';
import { gameState } from '../core/GameState';
import { Sfx } from '../ui/sfx';
import { createText } from '../ui/text';
import { ZERO_SPECIALS } from './ZeroAI';
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
  // 深海の渦：広い範囲で引き寄せ（ダメージなし）、爆発するのは中心だけ
  if (atk.pull) {
    const r = atk.pullRadius ?? 70;
    world.vortexEffect(e.aoeX, e.aoeY, e.vortexDir, windup);
    world.spawnAoe({ x: e.aoeX, y: e.aoeY, angle: 0, shape: { type: 'circle', radius: r }, duration: windup, power: 0, owner: e, noDamage: true, pull: atk.pull });
  }
  world.spawnAoe({
    x: e.aoeX,
    y: e.aoeY,
    angle,
    shape: atk.shape,
    duration: windup,
    power,
    owner: e,
    effect: atk.effect,
    leaveWater: atk.leaveWater,
    // 弾を撃つ攻撃は、予兆は軌道を見せるだけ（当たるのは弾）
    noDamage: !!atk.projectile,
  });
}

/** 予兆の線に沿って弾を撃つ */
function fireProjectiles(e: Enemy, world: CombatWorld, atk: EnemyAttackDef) {
  const pr = atk.projectile!;
  const count = pr.count ?? 1;
  const spread = ((pr.spread ?? 0) * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? e.attackAngle : e.attackAngle + spread * (i / (count - 1) - 0.5);
    world.spawnProjectile({
      x: e.x + Math.cos(a) * 8,
      y: e.y + Math.sin(a) * 8,
      angle: a,
      speed: pr.speed,
      distance: pr.distance,
      sprite: pr.sprite,
      power: e.atk * (atk.power ?? 1),
      hitRadius: pr.hitRadius ?? 4,
      hostile: true,
    });
  }
}

/** 中心から角度 a へ伸びる、長さ len・幅 w の帯（時計の針） */
export function band(cx: number, cy: number, a: number, len: number, w: number) {
  const nx = -Math.sin(a) * (w / 2);
  const ny = Math.cos(a) * (w / 2);
  const ex = cx + Math.cos(a) * len;
  const ey = cy + Math.sin(a) * len;
  return [
    { x: cx + nx, y: cy + ny },
    { x: ex + nx, y: ey + ny },
    { x: ex - nx, y: ey - ny },
    { x: cx - nx, y: cy - ny },
  ];
}

/** 角度 a0 から a1 までの扇形（多角形） */
export function wedge(cx: number, cy: number, a0: number, a1: number, r: number) {
  const pts = [{ x: cx, y: cy }];
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.15));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** 津波・尻尾の横薙ぎ：エリアの片側を覆う予兆のあと、帯が端から横切る */
function sweepAt(
  world: CombatWorld,
  A: { x: number; y: number; r: number },
  sw: NonNullable<EnemyAttackDef['sweep']>,
  power: number,
  windup: number,
  owner?: Enemy,
) {
  const fromLow = Math.random() < 0.5;
  const dir = fromLow ? 1 : -1;
  const coverLen = A.r * 2 * sw.cover;
  const center = sw.axis === 'y' ? A.y : A.x;
  const edge = center - dir * A.r;
  const mid = edge + (dir * coverLen) / 2;
  const angle = sw.axis === 'y' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
  const cross = sw.axis === 'y' ? A.x : A.y;
  world.spawnAoe({
    x: sw.axis === 'y' ? cross : mid,
    y: sw.axis === 'y' ? mid : cross,
    angle,
    shape: { type: 'rect', length: coverLen, width: A.r * 2 },
    duration: windup,
    power: 0,
    owner,
    noDamage: true,
    onResolve: () =>
      world.startSweep({
        axis: sw.axis,
        from: edge,
        to: edge + dir * coverLen,
        spanMin: cross - A.r,
        spanMax: cross + A.r,
        band: sw.band,
        speed: sw.speed,
        knockback: sw.knockback,
        power,
        leaveWater: sw.leaveWater,
      }),
  });
}

/** 回転する弾幕の本体 */
function vortexAt(e: Enemy, world: CombatWorld, atk: EnemyAttackDef, power: number, windup: number) {
  const v = atk.vortex!;
  e.vortexDir *= -1;
  const dir = e.vortexDir;
  world.vortexEffect(e.x, e.y, dir, windup + v.duration);
  const scene = world.gameScene;
  let base = Math.random() * Math.PI * 2;
  let n = 0;
  scene.time.delayedCall(windup * 1000, () => {
    scene.time.addEvent({
      delay: v.interval * 1000,
      repeat: Math.floor(v.duration / v.interval) - 1,
      callback: () => {
        if (!e.alive) return;
        base += dir * 0.35;
        for (let i = 0; i < v.spokes; i++) {
          const a = base + (i / v.spokes) * Math.PI * 2;
          world.spawnProjectile({
            x: e.x,
            y: e.y,
            angle: a,
            speed: v.speed,
            distance: 260,
            sprite: n % 2 ? 'fx_crystal_shard' : 'fx_water_orb',
            power,
            hitRadius: 4,
            hostile: true,
            curve: dir * 0.8,
          });
        }
        n++;
      },
    });
  });
  e.setEnemyState('windup', windup + v.duration);
}

/**
 * 過去のボスの幻影が現れ、そのボスの技を1つ使う（data/enemies.ts の技をそのまま使う）。
 * 過去再演（クロノス）・ワールドエコー（ZERO）・最終章のフィールドのしかけから使う。
 * power = 攻撃力（技の倍率を掛ける）、A = 幻影が出てよい範囲
 */
export function spawnBossEcho(
  world: CombatWorld,
  entry: { boss: string; pattern: string },
  power: number,
  A: { x: number; y: number; r: number },
  owner?: Enemy,
) {
  const def = ENEMIES[entry.boss];
  const pt = def?.boss?.patterns.find((x) => x.id === entry.pattern);
  if (!def || !pt) return;
  const scene = world.gameScene;
  const p = world.player;
  // プレイヤーから少し離れた場所に幻影（範囲の外には出さない）。十字斬は縦横の線がプレイヤーに重なる位置
  const a = pt.shape.type === 'cross' ? Math.floor(Math.random() * 4) * (Math.PI / 2) : Math.random() * Math.PI * 2;
  let gx = p.x + Math.cos(a) * 70;
  let gy = p.y + Math.sin(a) * 70;
  const d = Math.hypot(gx - A.x, gy - A.y);
  if (d > A.r - 20) {
    gx = A.x + ((gx - A.x) / d) * (A.r - 20);
    gy = A.y + ((gy - A.y) / d) * (A.r - 20);
  }
  const ghost = scene.add
    .sprite(gx, gy, def.sprite, 0)
    .setTintFill(0xc58cff)
    .setAlpha(0)
    .setDepth(gy)
    .setFlipX(p.x < gx);
  scene.tweens.add({ targets: ghost, alpha: 0.6, duration: 250 });
  world.showSpeech(gx, gy - ghost.height / 2 - 4, `${def.name}・${pt.name}`);
  const w = pt.windup;
  const pw = power * (pt.power ?? 1);
  const ang = Math.atan2(p.y - gy, p.x - gx);
  if (pt.sweep) {
    sweepAt(world, A, pt.sweep, pw, w, owner);
  } else if (pt.scatter) {
    const sc = pt.scatter;
    const onArena = sc.around === 'arena';
    for (let k = 0; k < sc.count; k++) {
      const sa = Math.random() * Math.PI * 2;
      const sd = onArena ? Math.sqrt(Math.random()) * A.r : k === 0 ? 0 : sc.radius * (0.3 + Math.random() * 0.7);
      world.spawnAoe({
        x: (onArena ? A.x : p.x) + Math.cos(sa) * sd,
        y: (onArena ? A.y : p.y) + Math.sin(sa) * sd,
        angle: 0,
        shape: pt.shape,
        duration: w,
        delay: k * sc.interval,
        power: pw,
        owner,
        effect: pt.effect,
      });
    }
  } else {
    const len = pt.shape.type === 'line' ? pt.shape.length : 50;
    world.spawnAoe({
      x: pt.at === 'target' ? p.x : gx,
      y: pt.at === 'target' ? p.y : gy,
      angle: pt.shape.type === 'cross' ? 0 : ang,
      shape: pt.shape,
      duration: w,
      power: pw,
      owner,
      effect: pt.effect,
      // 突進する技は、幻影が予兆の線に沿って駆け抜ける
      onResolve: pt.lunge
        ? () => scene.tweens.add({ targets: ghost, x: gx + Math.cos(ang) * len, y: gy + Math.sin(ang) * len, duration: 160 })
        : undefined,
    });
  }
  scene.time.delayedCall((w + 0.5) * 1000, () =>
    scene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() }),
  );
}

/** ボスエリアの中心と広さ */
export function arena(e: Enemy, atk: EnemyAttackDef) {
  return { x: e.homeX, y: e.homeY, r: atk.arenaRadius ?? 160 };
}

// ---------------------------------------------------------------- 特殊な攻撃

export type SpecialHandler = (e: Enemy, world: CombatWorld, atk: EnemyAttackDef, power: number, windup: number) => void;

// 技の名前 → 処理（最終章の技は systems/ZeroAI.ts）
const SPECIALS: Record<string, SpecialHandler> = {
  ...(ZERO_SPECIALS as Record<string, SpecialHandler>),
  // ---------------------------------------------------------------- 第4章 輪廻王クロノス

  /**
   * 時計盤：エリアいっぱいに時計盤が現れ、中心から伸びる針（帯）が回る。針に触れるとダメージ。
   * 溜めの間は針の位置と回る向き、動き出してからは「これから針が通る場所」を薄く表示する
   */
  clockHands: (e, world, atk, power, windup) => {
    const h = atk.hands!;
    const A = arena(e, atk);
    const scene = world.gameScene;
    const p = world.player;
    const g = scene.add.graphics().setDepth(-4985);
    const angles = h.speeds.map(() => Math.random() * Math.PI * 2);
    let t = -windup;
    let hitCd = 0;
    Sfx.chime();
    const onUpdate = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 50) / 1000;
      t += dt;
      hitCd -= dt;
      if (!e.alive || t > h.duration) return cleanup();
      const active = t > 0;
      if (active) h.speeds.forEach((sp, i) => (angles[i] += sp * dt));
      const fade = active ? Math.min(1, (h.duration - t) / 0.4) : Math.min(1, (t + windup) / 0.3);
      g.clear();
      // 文字盤
      g.fillStyle(0xffcd75, 0.06 * fade).fillCircle(A.x, A.y, A.r);
      g.lineStyle(2, 0xffcd75, 0.5 * fade).strokeCircle(A.x, A.y, A.r);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = i % 3 === 0 ? A.r - 14 : A.r - 7;
        g.lineStyle(i % 3 === 0 ? 2 : 1, 0xffcd75, 0.6 * fade);
        g.lineBetween(A.x + Math.cos(a) * r0, A.y + Math.sin(a) * r0, A.x + Math.cos(a) * A.r, A.y + Math.sin(a) * A.r);
      }
      angles.forEach((a, i) => {
        const len = A.r * (i === 0 ? 1 : 0.72);
        const sp = h.speeds[i];
        if (!active) {
          // 予兆：針の位置（赤い枠）と、回る向き（進む先の薄い扇）
          g.fillStyle(0xb13e53, 0.25 * fade).fillPoints(wedge(A.x, A.y, a, a + Math.sign(sp) * 0.5, len), true);
          g.lineStyle(1, 0xef7d57, fade).strokePoints(band(A.x, A.y, a, len, h.width), true);
          return;
        }
        // これから通る場所（0.6 秒ぶん）を薄く
        g.fillStyle(0xb13e53, 0.18 * fade).fillPoints(wedge(A.x, A.y, a, a + sp * 0.6, len), true);
        g.fillStyle(0xef7d57, 0.85 * fade).fillPoints(band(A.x, A.y, a, len, h.width), true);
        g.lineStyle(1, 0xffffff, 0.9 * fade).lineBetween(A.x, A.y, A.x + Math.cos(a) * len, A.y + Math.sin(a) * len);
        // 当たり判定（針の帯の中）
        if (hitCd <= 0 && !p.dead) {
          const dx = p.x - A.x;
          const dy = p.y - A.y;
          const along = dx * Math.cos(a) + dy * Math.sin(a);
          const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
          if (along > -4 && along < len && across < h.width / 2 + p.radius) {
            world.damagePlayer(power, A.x, A.y);
            hitCd = 0.8;
          }
        }
      });
      g.fillStyle(0xffcd75, fade).fillCircle(A.x, A.y, 4);
    };
    const cleanup = () => {
      scene.events.off('update', onUpdate);
      scene.events.off('shutdown', cleanup);
      g.destroy();
    };
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', cleanup);
    // 針が回っている間も、クロノスは別の攻撃をしてくる
    e.setEnemyState('windup', windup + 0.6);
  },

  /** 時間逆行：画面がセピア色になり、時計の針が逆回り。直前に受けたダメージの一部が巻き戻る */
  rewind: (e, world, atk, _power, windup) => {
    const rw = atk.rewind!;
    const scene = world.gameScene;
    const cam = scene.cameras.main;
    world.showSpeech(e.x, e.y - 20, '◀◀ 時間逆行');
    const fx = scene.game.renderer.type === Phaser.WEBGL ? cam.postFX.addColorMatrix() : null;
    fx?.sepia();
    const g = scene.add.graphics().setDepth(e.y + 2);
    const t = { v: 0 };
    scene.tweens.add({
      targets: t,
      v: 1,
      duration: windup * 1000,
      onUpdate: () => {
        g.clear();
        const cx = e.x;
        const cy = e.y - 8;
        const R = 30;
        g.lineStyle(2, 0xffcd75, 0.8).strokeCircle(cx, cy, R);
        // 逆回りする針
        const a1 = -t.v * Math.PI * 8;
        const a2 = -t.v * Math.PI * 2;
        g.lineStyle(2, 0xf4f4f4, 0.9).lineBetween(cx, cy, cx + Math.cos(a1) * (R - 4), cy + Math.sin(a1) * (R - 4));
        g.lineStyle(3, 0xf4f4f4, 0.9).lineBetween(cx, cy, cx + Math.cos(a2) * (R - 12), cy + Math.sin(a2) * (R - 12));
        // 吸い込まれていく光（流れた時間が戻ってくる）
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - t.v * 3;
          const r = R + 30 * (1 - ((t.v * 2 + i / 12) % 1));
          g.fillStyle(0xffcd75, 0.9).fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2);
        }
      },
      onComplete: () => g.destroy(),
    });
    scene.time.delayedCall(windup * 1000, () => {
      if (fx) cam.postFX.remove(fx as unknown as Phaser.FX.Controller);
      if (!e.alive) return;
      const amount = rw.flat ? e.maxHp * rw.flat : Math.min(e.recentDamage(rw.window) * rw.ratio, e.maxHp * rw.max);
      const healed = e.heal(Math.max(1, amount));
      cam.flash(300, 255, 205, 117);
      Sfx.chime();
      world.showBlast(e.x, e.y, 34, 0xffcd75);
      world.showFloat(e.x, e.y - 18, `+${healed}`, '#a7f070');
    });
    e.setEnemyState('windup', windup);
  },

  /**
   * 過去再演：過去のボスの幻影が現れ、そのボスの技を1つずつ使う（data/enemies.ts の技をそのまま使う）。
   * 幻影は技を撃ち終わると消える
   */
  reenact: (e, world, atk, _power, windup) => {
    const re = atk.reenact!;
    const A = arena(e, atk);
    const picks = [...re.pool].sort(() => Math.random() - 0.5).slice(0, re.count);
    picks.forEach((entry, i) => {
      world.gameScene.time.delayedCall(i * re.stagger * 1000, () => {
        if (e.alive) spawnBossEcho(world, entry, e.atk, A, e);
      });
    });
    e.setEnemyState('windup', windup + (picks.length - 1) * re.stagger);
  },

  /**
   * 輪廻の鎖：プレイヤーの周りに紫の円。解除の瞬間に円の中にいると鎖につながれて遅くなる。
   * そのあと、プレイヤーのいる場所へ追撃
   */
  chains: (e, world, atk, power, windup) => {
    const c = atk.chains!;
    const p = world.player;
    const scene = world.gameScene;
    let caught = false;
    const bind = (ax: number, ay: number) => {
      p.setChained(c.slowTime, c.slow);
      world.showSpeech(p.x, p.y - 10, '鎖につながれた！');
      const g = scene.add.graphics();
      let life = c.slowTime;
      const onUpdate = (_time: number, deltaMs: number) => {
        life -= deltaMs / 1000;
        if (life <= 0 || !p.chained || p.dead) return cleanup();
        g.clear().setDepth(p.y + 1);
        // 杭と、主人公へ伸びる鎖
        g.fillStyle(0x5d275d, 1).fillCircle(ax, ay, 3);
        g.lineStyle(1, 0xc58cff, 1).strokeCircle(ax, ay, 3);
        const links = 8;
        for (let k = 0; k <= links; k++) {
          const x = ax + ((p.x - ax) * k) / links;
          const y = ay + ((p.y - ay) * k) / links + Math.sin(k * 1.3) * 1.5;
          g.lineStyle(1, 0xc58cff, 1).strokeRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2);
        }
      };
      const cleanup = () => {
        scene.events.off('update', onUpdate);
        scene.events.off('shutdown', cleanup);
        g.destroy();
      };
      scene.events.on('update', onUpdate);
      scene.events.once('shutdown', cleanup);
    };
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < c.count; i++) {
      const a = base + (i / Math.max(1, c.count - 1)) * Math.PI * 2;
      const d = i === 0 ? 0 : 30 + Math.random() * 18;
      world.spawnAoe({
        x: p.x + Math.cos(a) * d,
        y: p.y + Math.sin(a) * d,
        angle: 0,
        shape: { type: 'circle', radius: c.radius },
        duration: windup,
        power: 0,
        owner: e,
        noDamage: true,
        color: 0xc58cff,
        onResolve: (spec) => {
          if (caught || p.dead) return;
          if (Math.hypot(p.x - spec.x, p.y - spec.y) <= c.radius + p.radius) {
            caught = true;
            bind(spec.x, spec.y);
          }
        },
      });
    }
    // 追撃：鎖が出たあと、そのときのプレイヤーの位置へ
    scene.time.delayedCall((windup + 0.25) * 1000, () => {
      if (!e.alive || p.dead) return;
      world.spawnAoe({ x: p.x, y: p.y, angle: 0, shape: c.followUp, duration: c.followWindup, power, owner: e, effect: 'meteor' });
    });
    e.setEnemyState('windup', windup + 0.25 + c.followWindup);
  },

  /**
   * 終焉時計：エリアの中央に巨大な時計が現れ、カウントダウン。
   * 0 になるとエリアのほとんどを覆う大爆発（安全地帯だけが助かる）
   */
  doomClock: (e, world, atk, power, windup) => {
    const A = arena(e, atk);
    const scene = world.gameScene;
    // クロノスは玉座の方（エリアの奥）へ瞬間移動し、中央を時計に明け渡す
    world.showBlast(e.x, e.y, 20, 0xffcd75);
    e.body.setVelocity(0, 0);
    e.setPosition(A.x, A.y - A.r * 0.7);
    world.showBlast(e.x, e.y, 20, 0xffcd75);
    const spots: { x: number; y: number; r: number }[] = [];
    const count = atk.safeSpots ?? 2;
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const a = base + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const d = A.r * (0.55 + Math.random() * 0.25);
        const x = A.x + Math.cos(a) * d;
        const y = A.y + Math.sin(a) * d;
        if (!world.isWall(x, y) || tries === 29) {
          spots.push({ x, y, r: 16 });
          break;
        }
      }
    }
    world.spawnAoe({ x: A.x, y: A.y, angle: 0, shape: { type: 'circle', radius: A.r + 40 }, duration: windup, power, owner: e, effect: 'finale', holes: spots });
    for (const s of spots) world.spawnAoe({ x: s.x, y: s.y, angle: 0, shape: { type: 'circle', radius: s.r }, duration: windup, power: 0, safe: true, owner: e });
    // 巨大な時計とカウントダウン
    const g = scene.add.graphics().setDepth(-4980);
    const txt = createText(scene, A.x, A.y - 46, '', 16, '#ffd23f', { stroke: '#1a1c2c', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(50000);
    let left = windup;
    let shown = -1;
    const R = 34;
    const onUpdate = (_time: number, deltaMs: number) => {
      left -= Math.min(deltaMs, 50) / 1000;
      if (left <= 0 || !e.alive) return cleanup();
      const done = 1 - left / windup;
      g.clear();
      g.fillStyle(0x1a1c2c, 0.6).fillCircle(A.x, A.y, R);
      // 過ぎた時間（赤い扇）
      g.fillStyle(0xb13e53, 0.45).fillPoints(wedge(A.x, A.y, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2, R), true);
      g.lineStyle(3, 0xffcd75, 1).strokeCircle(A.x, A.y, R);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.lineStyle(i % 3 === 0 ? 2 : 1, 0xffcd75, 1);
        g.lineBetween(A.x + Math.cos(a) * (R - 6), A.y + Math.sin(a) * (R - 6), A.x + Math.cos(a) * R, A.y + Math.sin(a) * R);
      }
      const ha = -Math.PI / 2 + done * Math.PI * 2;
      g.lineStyle(2, 0xf4f4f4, 1).lineBetween(A.x, A.y, A.x + Math.cos(ha) * (R - 4), A.y + Math.sin(ha) * (R - 4));
      const sec = Math.ceil(left);
      if (sec !== shown) {
        shown = sec;
        txt.setText(String(sec)).setScale(1.6);
        scene.tweens.add({ targets: txt, scale: 1, duration: 250, ease: 'Back.easeOut' });
        Sfx.chime();
      }
    };
    const cleanup = () => {
      scene.events.off('update', onUpdate);
      scene.events.off('shutdown', cleanup);
      g.destroy();
      txt.destroy();
    };
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', cleanup);
    e.setEnemyState('windup', windup);
  },

  /**
   * 時間停止：画面がモノクロになり、プレイヤーの足元と周りに予兆。
   * 動けるのは moveTime 秒だけ。そのあとは解除（すべて同時に爆発）まで動けない
   */
  timeFreeze: (e, world, atk, power, windup) => {
    const fr = atk.freeze!;
    const p = world.player;
    const scene = world.gameScene;
    world.timeStopEffect(windup, p.x, p.y);
    const shape = { type: 'circle' as const, radius: fr.radius };
    world.spawnAoe({ x: p.x, y: p.y, angle: 0, shape, duration: windup, power, owner: e, effect: 'meteor' });
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < fr.count; i++) {
      const a = base + (i / fr.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const d = 40 + Math.random() * 14;
      world.spawnAoe({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, angle: 0, shape, duration: windup, power, owner: e, effect: 'meteor' });
    }
    world.showSpeech(p.x, p.y - 12, '時が止まる……！');
    scene.time.delayedCall(fr.moveTime * 1000, () => {
      if (!e.alive || p.dead) return;
      p.freeze(windup - fr.moveTime);
      world.showSpeech(p.x, p.y - 12, '（動けない！）');
    });
    e.setEnemyState('windup', windup);
  },

  /**
   * 潜航：水中へ潜って見えなくなり、予兆の円がプレイヤーを追いかける。
   * 追いかけ終わると止まり、その場所へ飛び出して範囲攻撃
   */
  submerge: (e, world, atk, power, windup) => {
    const p = world.player;
    e.setHidden(true);
    world.showAoeEffect({ x: e.x, y: e.y, angle: 0, shape: { type: 'circle', radius: 14 }, duration: 0, power: 0, effect: 'splash' });
    world.spawnAoe({
      x: p.x,
      y: p.y,
      angle: 0,
      shape: atk.shape,
      duration: windup,
      follow: atk.followTime ?? windup * 0.65,
      power,
      owner: e,
      effect: atk.effect ?? 'splash',
      leaveWater: atk.leaveWater,
      onResolve: (spec) => {
        e.setPosition(spec.x, spec.y);
        e.setHidden(false);
      },
    });
    e.setEnemyState('windup', windup);
  },

  /**
   * 津波・尻尾の横薙ぎ：エリアの片側を覆う長方形の予兆のあと、帯が端から高速で横切る。
   * 当たるとダメージと、進む向きへのノックバック
   */
  sweep: (e, world, atk, power, windup) => {
    sweepAt(world, arena(e, atk), atk.sweep!, power, windup, e);
    e.setEnemyState('windup', windup);
  },

  /** 回転する弾幕：渦の予兆のあと、弾が渦を巻きながら広がる。回る向きは毎回反対 */
  vortex: (e, world, atk, power, windup) => {
    vortexAt(e, world, atk, power, windup);
  },

  /**
   * 記憶喰らい：プレイヤーの周りに、過去の主人公を思わせる幻影が現れ、
   * 1体ずつ時間差でプレイヤーのいた場所へ突撃する（突撃先に小さな予兆）
   */
  phantoms: (e, world, atk, power, windup) => {
    const ph = atk.phantoms!;
    const p = world.player;
    const scene = world.gameScene;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < ph.count; i++) {
      const a = baseAngle + (i / ph.count) * Math.PI * 2;
      const sx = p.x + Math.cos(a) * 70;
      const sy = p.y + Math.sin(a) * 70;
      const ghost = scene.add
        .image(sx, sy, p.texture.key, 0)
        .setTintFill(0x73eff7)
        .setAlpha(0)
        .setFlipX(Math.cos(a) > 0)
        .setDepth(sy);
      scene.tweens.add({ targets: ghost, alpha: 0.55, duration: 250 });
      const delay = i * ph.stagger;
      // 突撃先は、その幻影が動き出す少し前のプレイヤーの位置
      scene.time.delayedCall(delay * 1000, () => {
        if (!e.alive) return ghost.destroy();
        world.spawnAoe({
          x: p.x,
          y: p.y,
          angle: 0,
          shape: atk.shape,
          duration: windup,
          power,
          owner: e,
          effect: 'splash',
          onResolve: (spec) => {
            scene.tweens.add({
              targets: ghost,
              x: spec.x,
              y: spec.y,
              duration: 90,
              onComplete: () => scene.tweens.add({ targets: ghost, alpha: 0, duration: 200, onComplete: () => ghost.destroy() }),
            });
          },
        });
      });
      // 念のため：倒されて予兆が消えた場合も幻影を片付ける
      scene.time.delayedCall((delay + windup + 1) * 1000, () => ghost.active && ghost.destroy());
    }
    e.setEnemyState('windup', windup + (ph.count - 1) * ph.stagger);
  },

  /** 輪廻の海：エリアの大部分を水にする（ダメージはないが遅くなる）。乾いた島だけが残る */
  sea: (e, world, atk, _power, windup) => {
    const A = arena(e, atk);
    const scene = world.gameScene;
    scene.cameras.main.shake(700, 0.01);
    scene.cameras.main.flash(400, 65, 166, 246);
    Sfx.boom(0.5);
    // 乾いた島
    const islands: { x: number; y: number }[] = [];
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = A.r * (0.2 + Math.random() * 0.6);
        const x = A.x + Math.cos(a) * d;
        const y = A.y + Math.sin(a) * d;
        if (!world.isWall(x, y) && islands.every((o) => Math.hypot(o.x - x, o.y - y) > 60)) {
          islands.push({ x, y });
          break;
        }
      }
    }
    const step = 30;
    for (let gx = -A.r; gx <= A.r; gx += step) {
      for (let gy = -A.r; gy <= A.r; gy += step) {
        const x = A.x + gx;
        const y = A.y + gy;
        if (Math.hypot(gx, gy) > A.r || world.isWall(x, y)) continue;
        if (islands.some((o) => Math.hypot(o.x - x, o.y - y) < 36)) continue;
        // 少しずつ広がっていく
        scene.time.delayedCall(Math.hypot(gx, gy) * 3, () => world.spawnWater(x, y, 24, 999));
      }
    }
    e.setEnemyState('windup', windup);
  },

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
      if (atk?.projectile) fireProjectiles(e, world, atk);
      if (atk?.leap) {
        // 範囲の中心へ跳ぶ
        const t = atk.leapTime ?? 0.2;
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
  // 攻撃のあとの小休止（攻撃中は減らない）
  e.attackCooldown -= dt;
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
      } else if (dist <= def.attackRange + p.radius + e.radius && e.attackCooldown <= 0) {
        e.attackCooldown = ENEMY.attackCooldown * (1 + Math.random() * 0.5);
        const alt = def.altAttack;
        e.attackCount++;
        beginAttack(e, world, alt && e.attackCount % alt.every === 0 ? alt.attack : (e.attackOverride ?? def.attack));
      } else if (dist <= def.attackRange + p.radius + e.radius) {
        // 次の攻撃まで待つあいだは、近づきすぎずに様子を見る
        e.body.setVelocity(0, 0);
      } else if (def.mimic) {
        // エコー：プレイヤーの動きをまねる（少しだけ近づく）
        const pv = p.body.velocity;
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        e.body.setVelocity(pv.x * 0.8 + Math.cos(ang) * 12, pv.y * 0.8 + Math.sin(ang) * 12);
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
    const usable = b.patterns.filter(
      (pt) =>
        dist <= pt.range + p.radius + e.radius &&
        e.phase >= (pt.minPhase ?? 1) &&
        e.phase <= (pt.maxPhase ?? 99) &&
        gameState.story.loop >= (pt.minLoop ?? 1) &&
        (pt.maxUses === undefined || (e.uses.get(pt.id) ?? 0) < pt.maxUses),
    );
    const pattern = weightedPick(usable, (pt) => pt.weight);
    if (pattern) {
      beginAttack(e, world, pattern);
      e.uses.set(pattern.id, (e.uses.get(pattern.id) ?? 0) + 1);
      e.attackCooldown = b.interval * (b.intervalByPhase?.[e.phase - 1] ?? 1) * loopIntervalMul();
      return;
    }
  }
  // 近すぎなければ寄っていく
  if (dist > e.radius + p.radius + 10) moveToward(e, p.x, p.y, e.def.moveSpeed);
  else e.body.setVelocity(0, 0);
};

/** 周回ごとにボスの攻撃間隔が縮む */
function loopIntervalMul(): number {
  return Math.max(LOOP.bossIntervalMin, 1 - (gameState.story.loop - 1) * LOOP.bossIntervalPerLoop);
}

/**
 * ボスの相棒（水色の FIT）：自分では攻撃しない。ボスの技で動かされていないときは、
 * ボスとはプレイヤーをはさんで反対側に回り込む
 */
const partner: AiHandler = (e, _dt, world) => {
  const main = e.link;
  if (!main || !main.alive) {
    e.body.setVelocity(0, 0);
    return;
  }
  if (e.controlled) return;
  const p = world.player;
  const ang = Math.atan2(p.y - main.y, p.x - main.x);
  const tx = p.x + Math.cos(ang) * 60;
  const ty = p.y + Math.sin(ang) * 60;
  if (Math.hypot(tx - e.x, ty - e.y) > 6) moveToward(e, tx, ty, e.def.moveSpeed);
  else e.body.setVelocity(0, 0);
};

export const ENEMY_AI: Record<EnemyAiKind, AiHandler> = {
  melee,
  boss,
  partner,
};

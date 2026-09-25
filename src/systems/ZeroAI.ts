import type { EnemyAttackDef } from '../core/types';
import type { Enemy } from '../entities/Enemy';
import { Sfx } from '../ui/sfx';
import type { CombatWorld } from './CombatWorld';
import type { SpecialHandler } from './EnemyAI';

// 最終章のボスの技
//   ZERO（第一形態）：ZEROキャノン／道路崩壊／終焉ドライブ／最後の記憶／ZERO END
//   赤と水色の FIT（第二形態）：初代と二代目／ツインブースト／クロスドライブ／レッド＆ブルー・サークル／
//     ツインレーザー／カラーチェンジ／ツイン・スピン／赤の轍・蒼の轍／ダブルブレーキ／ツインホーミング／
//     オーバーテイク／ツインメテオ／ツイン・オーバードライブ
// 車の動きは見た目（予兆の判定で当たる）。接触で当たる技だけ、その場で当たり判定をとる

const RED = 0xb13e53;
const CYAN = 0x41a6f6;

/** 四角いボスエリア（中心・横の半分・縦の半分） */
function rect(e: Enemy, atk: EnemyAttackDef) {
  const r = atk.arenaRadius ?? 88;
  return { x: e.homeX, y: e.homeY, r, h: atk.arenaHalfH ?? r };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const opt = (atk: EnemyAttackDef, key: string, def: number) => atk.opts?.[key] ?? def;

/** 生きているときだけ、少し後に実行 */
function later(e: Enemy, world: CombatWorld, sec: number, fn: () => void) {
  world.gameScene.time.delayedCall(sec * 1000, () => {
    if (e.alive) fn();
  });
}

/** 車を (x, y) まで走らせる（見た目の移動。技の間は自分では動かない） */
function drive(world: CombatWorld, car: Enemy, x: number, y: number, ms: number, ease = 'Quad.easeIn') {
  car.controlled = true;
  car.body.setVelocity(0, 0);
  if (Math.abs(x - car.x) > 1) car.setFlipX(x < car.x);
  const pos = { x: car.x, y: car.y };
  world.gameScene.tweens.add({
    targets: pos,
    x,
    y,
    duration: ms,
    ease,
    onUpdate: () => {
      if (car.active) car.body.reset(pos.x, pos.y);
    },
  });
}

/** 技が終わったら、2台とも自由に動けるようにする */
function release(e: Enemy, world: CombatWorld, sec: number) {
  world.gameScene.time.delayedCall(sec * 1000, () => {
    e.controlled = false;
    if (e.partner) e.partner.controlled = false;
  });
}

/** 毎フレームの処理を duration 秒だけ動かす（シーンが止まっている間は止まる） */
function everyFrame(world: CombatWorld, duration: number, fn: (dt: number, t: number) => void, onEnd?: () => void) {
  const scene = world.gameScene;
  let t = 0;
  const onUpdate = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    t += dt;
    if (t >= duration) {
      cleanup();
      onEnd?.();
      return;
    }
    fn(dt, t);
  };
  const cleanup = () => {
    scene.events.off('update', onUpdate);
    scene.events.off('shutdown', cleanup);
  };
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', cleanup);
}

/** 車に触れたらダメージ（cd 秒に1回） */
function contact(world: CombatWorld, car: Enemy, power: number, state: { cd: number }, dt: number) {
  state.cd -= dt;
  const p = world.player;
  if (state.cd > 0 || p.dead || !car.active) return;
  if (Math.hypot(p.x - car.x, p.y - car.y) <= car.radius + p.radius + 2) {
    world.damagePlayer(power, car.x, car.y);
    state.cd = 0.6;
  }
}

/** (x0, y0) から (x1, y1) までの直線の予兆 */
function lineAoe(world: CombatWorld, e: Enemy, x0: number, y0: number, x1: number, y1: number, width: number, duration: number, power: number, delay = 0, onResolve?: () => void) {
  world.spawnAoe({
    x: x0,
    y: y0,
    angle: Math.atan2(y1 - y0, x1 - x0),
    shape: { type: 'line', length: Math.hypot(x1 - x0, y1 - y0), width },
    duration,
    delay,
    power,
    owner: e,
    onResolve: onResolve ? () => onResolve() : undefined,
  });
}

/**
 * 点 (x, y) から角度 a の方向へ、四角いエリアの端まで進んだ点。
 * 点がエリアの外（入口の道など）にあっても、エリアの中へ寄せてから計算する（線が無限に長くならないように）
 */
function toEdge(A: ReturnType<typeof rect>, x: number, y: number, a: number, margin = 10) {
  const left = A.x - A.r - margin;
  const right = A.x + A.r + margin;
  const top = A.y - A.h - margin;
  const bottom = A.y + A.h + margin;
  const cx = clamp(x, left, right);
  const cy = clamp(y, top, bottom);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const ts: number[] = [];
  if (Math.abs(dx) > 1e-6) ts.push(((dx > 0 ? right : left) - cx) / dx);
  if (Math.abs(dy) > 1e-6) ts.push(((dy > 0 ? bottom : top) - cy) / dy);
  const t = Math.max(0, Math.min(...ts));
  return { x: cx + dx * t, y: cy + dy * t };
}

/** プレイヤーを通る直線の、エリアの両端（角度 a） */
function lineThrough(A: ReturnType<typeof rect>, px: number, py: number, a: number) {
  const back = toEdge(A, px, py, a + Math.PI);
  const front = toEdge(A, px, py, a);
  return { from: back, to: front };
}

/** 車が一瞬で画面を横切る残像（オーバードライブ） */
function streak(world: CombatWorld, sprite: string, x0: number, y0: number, x1: number, y1: number, tint: number) {
  const scene = world.gameScene;
  const img = scene.add.image(x0, y0, sprite, 0).setTintFill(tint).setAlpha(0.9).setDepth(60000).setFlipX(x1 < x0);
  scene.tweens.add({ targets: img, x: x1, y: y1, duration: 180, onComplete: () => scene.tweens.add({ targets: img, alpha: 0, duration: 200, onComplete: () => img.destroy() }) });
}

export const ZERO_SPECIALS: Partial<Record<NonNullable<EnemyAttackDef['special']>, SpecialHandler>> = {
  // ================================================================ ZERO（第一形態）

  /** ZEROキャノン：プレイヤーの方向へエネルギー弾。壁で反射する直線の予兆。フェーズ2からは追尾弾も */
  zeroCannon: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const p = world.player;
    const bounces = opt(atk, 'bounces', 2);
    const width = opt(atk, 'width', 16);
    let x = e.x;
    let y = e.y;
    let a = Math.atan2(p.y - y, p.x - x);
    const path: { x: number; y: number }[] = [{ x, y }];
    for (let i = 0; i <= bounces; i++) {
      const end = toEdge(A, x, y, a, -2);
      lineAoe(world, e, x, y, end.x, end.y, width, windup + i * 0.15, power);
      path.push(end);
      // 壁で反射
      const hitX = Math.abs(end.x - (A.x + A.r - 2)) < 1 || Math.abs(end.x - (A.x - A.r + 2)) < 1;
      a = hitX ? Math.PI - a : -a;
      x = end.x;
      y = end.y;
    }
    // 弾が反射しながら飛ぶ見た目
    later(e, world, windup, () => {
      const scene = world.gameScene;
      const orb = scene.add.image(path[0].x, path[0].y, 'fx_orb_red', 0).setScale(2).setDepth(60000);
      const tw = path.slice(1).map((pt) => ({ x: pt.x, y: pt.y, duration: 110 }));
      scene.tweens.chain({ targets: orb, tweens: tw, onComplete: () => orb.destroy() });
      Sfx.boom(0.2);
      // 追尾弾（フェーズ2から）
      if (e.phase >= 2) {
        for (let i = 0; i < 2; i++) {
          world.spawnProjectile({ x: e.x, y: e.y, angle: Math.random() * Math.PI * 2, speed: 55, distance: 300, sprite: 'fx_orb_red', power: power * 0.6, hitRadius: 4, hostile: true, homing: 1.6 });
        }
      }
    });
    e.setEnemyState('windup', windup + 0.3);
  },

  /** 道路崩壊：エリアの外側から順に、道路が消えていく（予兆のあとに穴。落ちたら即死）。しばらくすると戻る */
  roadCollapse: (e, world, atk, _power, windup) => {
    const A = rect(e, atk);
    const cell = 32;
    const cols = Math.floor((A.r * 2) / cell);
    const rows = Math.floor((A.h * 2) / cell);
    const x0 = A.x - (cols * cell) / 2;
    const y0 = A.y - (rows * cell) / 2;
    const cells: { x: number; y: number; d: number }[] = [];
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const x = x0 + cx * cell + cell / 2;
        const y = y0 + cy * cell + cell / 2;
        // 端に近いほど先に消える（少しばらつかせる）
        const d = Math.max(Math.abs(x - A.x) / A.r, Math.abs(y - A.y) / A.h) + Math.random() * 0.35;
        cells.push({ x, y, d });
      }
    }
    cells.sort((a, b) => b.d - a.d);
    const waves = opt(atk, 'waves', 3);
    const perWave = opt(atk, 'perWave', 4);
    const open = opt(atk, 'open', 5);
    for (let w = 0; w < waves; w++) {
      const group = cells.slice(w * perWave, (w + 1) * perWave);
      later(e, world, windup + w * 0.9, () => {
        for (const c of group) world.spawnPit(c.x, c.y, cell, cell, 1.4, open, true);
      });
    }
    world.showSpeech(e.x, e.y - 20, '道路が崩れる……！');
    e.setEnemyState('windup', windup + 0.5);
  },

  /** 終焉ドライブ：ZERO がいろいろな方向からプレイヤーを通る直線を高速で横切る。走った跡は燃える */
  endDrive: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const count = opt(atk, 'count', 4);
    const gap = opt(atk, 'interval', 1.0);
    for (let i = 0; i < count; i++) {
      later(e, world, i * gap, () => {
        const p = world.player;
        const dirs = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
        const a = dirs[i % dirs.length] + (Math.random() < 0.5 ? 0 : Math.PI);
        const { from, to } = lineThrough(A, p.x, p.y, a);
        drive(world, e, from.x, from.y, 150, 'Linear');
        lineAoe(world, e, from.x, from.y, to.x, to.y, 26, windup, power, 0, () => {
          drive(world, e, to.x, to.y, 180, 'Linear');
          // 走った跡に炎
          const n = Math.max(1, Math.min(40, Math.floor(Math.hypot(to.x - from.x, to.y - from.y) / 14)));
          for (let k = 0; k <= n; k++) {
            const x = from.x + ((to.x - from.x) * k) / n;
            const y = from.y + ((to.y - from.y) * k) / n;
            world.spawnHazard({ x, y, radius: 9, duration: 3, power: power * 0.25, tick: 0.4 });
          }
          world.gameScene.cameras.main.shake(120, 0.004);
        });
      });
    }
    // 最後はエリアの中に戻る
    later(e, world, (count - 1) * gap + windup + 0.5, () => drive(world, e, A.x, A.y - A.h * 0.4, 400, 'Quad.easeOut'));
    release(e, world, (count - 1) * gap + windup + 1);
    e.setEnemyState('windup', (count - 1) * gap + windup + 1);
  },

  /**
   * 最後の記憶（HP20%以下）：第1〜4章の景色がエリアに重なって浮かび、
   * 過去のボスの技と道路の崩壊が、戦いが終わるまで続くようになる
   */
  memoryRelease: (e, world, atk, _power, windup) => {
    const A = rect(e, atk);
    const scene = world.gameScene;
    scene.cameras.main.shake(800, 0.01);
    scene.cameras.main.flash(500, 255, 255, 255);
    Sfx.boom(0.5);
    world.showSpeech(e.x, e.y - 20, 'すべての記憶を、解き放つ');
    // 4つの章の景色がいっせいに浮かぶ
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ].forEach(([fx, fy], i) => later(e, world, i * 0.2, () => world.memoryFlash(A.x + fx * A.r, A.y + fy * A.h, 4, i === 0)));
    world.setGimmicks({
      memory: { interval: 1.6, duration: 3, label: false },
      echo: {
        interval: opt(atk, 'echoInterval', 3.4),
        pool: [
          { boss: 'varg', pattern: 'breath' },
          { boss: 'varg', pattern: 'flame_rain' },
          { boss: 'gradion', pattern: 'kings_pursuit' },
          { boss: 'gradion', pattern: 'cross_slash' },
          { boss: 'abyss_dragoon', pattern: 'crystal_rain' },
          { boss: 'chronos', pattern: 'time_bomb' },
          { boss: 'chronos', pattern: 'chronos_ray' },
        ],
      },
      vanish: { interval: opt(atk, 'vanishInterval', 3), size: 32, warn: 1.4, duration: 4, lethal: true },
    });
    e.setEnemyState('windup', windup);
  },

  /**
   * ZERO END：ZERO が中央へ移り、エリア全体へ広がっていく巨大な円。安全地帯は1か所だけ。
   * 耐えきれば ZERO 撃破（HP が 0 になると必ずこの技を使う）
   */
  zeroEnd: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const scene = world.gameScene;
    world.showBlast(e.x, e.y, 24, 0xf4f4f4);
    drive(world, e, A.x, A.y, 300, 'Quad.easeOut');
    scene.cameras.main.flash(400, 0, 0, 0);
    world.showSpeech(A.x, A.y - 28, 'ZERO END');
    // 安全地帯（1か所・壁でない場所）
    let spot = { x: A.x, y: A.y + A.h * 0.6, r: 16 };
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * Math.PI * 2;
      const x = A.x + Math.cos(a) * A.r * (0.5 + Math.random() * 0.3);
      const y = A.y + Math.sin(a) * A.h * (0.5 + Math.random() * 0.3);
      if (!world.isWall(x, y)) {
        spot = { x, y, r: 16 };
        break;
      }
    }
    const R = Math.hypot(A.r, A.h) + 30;
    world.spawnAoe({
      x: A.x,
      y: A.y,
      angle: 0,
      shape: { type: 'circle', radius: R },
      duration: windup,
      power,
      owner: e,
      effect: 'finale',
      holes: [spot],
      grow: true,
      onResolve: () => {
        // プレイヤーが耐えきった → ZERO 撃破。倒れていたらもう一度
        scene.time.delayedCall(600, () => {
          if (!e.alive) return;
          if (!world.player.dead) {
            e.finisherDone = true;
            world.defeatEnemy(e);
          } else {
            e.forcedPattern = (atk as { id?: string }).id ?? 'zero_end';
          }
        });
      },
    });
    world.spawnAoe({ x: spot.x, y: spot.y, angle: 0, shape: { type: 'circle', radius: spot.r }, duration: windup, power: 0, safe: true, owner: e });
    e.setEnemyState('windup', windup + 1.5);
  },

  // ================================================================ 赤と水色の FIT（第二形態）

  /** 初代と二代目：1台の FIT が赤と水色の2台に分かれ、プレイヤーを左右からはさむ（第二形態の最初だけ） */
  twinSplit: (e, world, _atk, _power, windup) => {
    const c = e.partner;
    const p = world.player;
    const scene = world.gameScene;
    scene.cameras.main.flash(400, 255, 255, 255);
    Sfx.chime();
    if (c) {
      c.body.reset(e.x, e.y);
      drive(world, c, p.x + 56, p.y, 600, 'Quad.easeOut');
      later(e, world, 0.7, () => world.showSpeech(c.x, c.y - 16, '二代目'));
    }
    drive(world, e, p.x - 56, p.y, 600, 'Quad.easeOut');
    later(e, world, 0.7, () => world.showSpeech(e.x, e.y - 16, '初代'));
    release(e, world, windup);
    e.setEnemyState('windup', windup);
  },

  /** ツインブースト：左右から2台が同時に、プレイヤーのいる場所を狙って突進。そのまま走り抜ける */
  twinBoost: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const p = world.player;
    const c = e.partner;
    const cars = c ? [e, c] : [e];
    cars.forEach((car, i) => {
      const side = i === 0 ? -1 : 1;
      const sx = A.x + side * (A.r + 6);
      const sy = clamp(p.y + (i === 0 ? -28 : 28), A.y - A.h, A.y + A.h);
      drive(world, car, sx, sy, 250, 'Quad.easeOut');
      const a = Math.atan2(p.y - sy, p.x - sx);
      const end = toEdge(A, p.x, p.y, a, 6);
      later(e, world, 0.25, () =>
        lineAoe(world, e, sx, sy, end.x, end.y, 22, windup, power, 0, () => {
          drive(world, car, end.x, end.y, 200, 'Linear');
          // 走り抜けたあと、エリアの中へ戻る
          later(e, world, 0.5, () => drive(world, car, clamp(end.x, A.x - A.r + 12, A.x + A.r - 12), clamp(end.y, A.y - A.h + 12, A.y + A.h - 12), 300, 'Quad.easeOut'));
        }),
      );
    });
    release(e, world, windup + 1.2);
    e.setEnemyState('windup', windup + 1.2);
  },

  /** クロスドライブ：赤は左上→右下、水色は右上→左下へ。X 字に交差する（交差点は特に危険） */
  crossDrive: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const p = world.player;
    const c = e.partner;
    const starts = [
      { x: A.x - A.r, y: A.y - A.h },
      { x: A.x + A.r, y: A.y - A.h },
    ];
    [e, c].forEach((car, i) => {
      if (!car) return;
      const s = starts[i];
      drive(world, car, s.x, s.y, 300, 'Quad.easeOut');
      const a = Math.atan2(p.y - s.y, p.x - s.x);
      const end = toEdge(A, p.x, p.y, a, -4);
      later(e, world, 0.3, () => lineAoe(world, e, s.x, s.y, end.x, end.y, 26, windup, power, 0, () => drive(world, car, end.x, end.y, 220, 'Linear')));
    });
    // 交差点
    const px = p.x;
    const py = p.y;
    later(e, world, 0.3, () =>
      world.spawnAoe({ x: px, y: py, angle: 0, shape: { type: 'circle', radius: 22 }, duration: windup + 0.12, power: power * 1.3, owner: e, effect: 'meteor' }),
    );
    release(e, world, windup + 1);
    e.setEnemyState('windup', windup + 1);
  },

  /** レッド＆ブルー・サークル：プレイヤーのまわりを2台がまわり、輪を狭めていく。最後に中央へ突進 */
  twinCircle: (e, world, atk, power, windup) => {
    const p = world.player;
    const c = e.partner;
    const cx = p.x;
    const cy = p.y;
    const T = opt(atk, 'duration', 3);
    const g = world.gameScene.add.graphics().setDepth(-4990);
    const cdA = { cd: 0 };
    const cdB = { cd: 0 };
    e.controlled = true;
    if (c) c.controlled = true;
    everyFrame(
      world,
      T,
      (dt, t) => {
        const r = 72 - (72 - 26) * (t / T);
        const a = t * 2.6;
        e.body.reset(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        e.setFlipX(Math.sin(a) > 0);
        contact(world, e, power * 0.6, cdA, dt);
        if (c) {
          c.body.reset(cx + Math.cos(a + Math.PI) * r, cy + Math.sin(a + Math.PI) * r);
          c.setFlipX(Math.sin(a + Math.PI) > 0);
          contact(world, c, power * 0.6, cdB, dt);
        }
        g.clear().lineStyle(1, 0xf4f4f4, 0.6).strokeCircle(cx, cy, r);
      },
      () => {
        g.destroy();
        if (!e.alive) return;
        drive(world, e, cx - 6, cy, 150, 'Linear');
        if (c) drive(world, c, cx + 6, cy, 150, 'Linear');
      },
    );
    // 最後の1秒だけ、中央の爆発の予兆
    world.spawnAoe({ x: cx, y: cy, angle: 0, shape: { type: 'circle', radius: 30 }, duration: 1.0, delay: T - 0.85, power, owner: e, effect: 'finale' });
    release(e, world, T + 0.6);
    e.setEnemyState('windup', Math.max(windup, T + 0.6));
  },

  /** ツインレーザー：左右に分かれ、ヘッドライトからレーザー。プレイヤーを追って回り、2本が交差する */
  twinLaser: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const c = e.partner;
    const p = world.player;
    const scene = world.gameScene;
    const cars = [e, c].filter((x): x is Enemy => !!x);
    cars.forEach((car, i) => drive(world, car, A.x + (i === 0 ? -1 : 1) * (A.r - 8), A.y, 350, 'Quad.easeOut'));
    const active = opt(atk, 'duration', 2.6);
    const turn = opt(atk, 'turn', 0.8);
    const angles = cars.map(() => 0);
    const cds = cars.map(() => ({ cd: 0 }));
    const g = scene.add.graphics().setDepth(60000);
    const colors = [RED, CYAN];
    later(e, world, 0.35, () => {
      cars.forEach((car, i) => (angles[i] = Math.atan2(p.y - car.y, p.x - car.x)));
      everyFrame(
        world,
        windup + active,
        (dt, t) => {
          g.clear();
          const firing = t > windup;
          const ends: { x0: number; y0: number; x1: number; y1: number }[] = [];
          cars.forEach((car, i) => {
            if (!car.active) return;
            // プレイヤーの方へ少しずつ回る
            const want = Math.atan2(p.y - car.y, p.x - car.x);
            let d = want - angles[i];
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            angles[i] += clamp(d, -turn * dt, turn * dt);
            const a = angles[i];
            const x1 = car.x + Math.cos(a) * 360;
            const y1 = car.y + Math.sin(a) * 360;
            ends.push({ x0: car.x, y0: car.y, x1, y1 });
            if (!firing) {
              g.lineStyle(1, colors[i], 0.4 + Math.sin(t * 30) * 0.3).lineBetween(car.x, car.y, x1, y1);
              return;
            }
            g.lineStyle(10, colors[i], 0.55).lineBetween(car.x, car.y, x1, y1);
            g.lineStyle(3, 0xffffff, 0.9).lineBetween(car.x, car.y, x1, y1);
            // 当たり判定
            cds[i].cd -= dt;
            const dx = p.x - car.x;
            const dy = p.y - car.y;
            const along = dx * Math.cos(a) + dy * Math.sin(a);
            const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
            if (cds[i].cd <= 0 && !p.dead && along > 0 && across < 5 + p.radius) {
              world.damagePlayer(power, car.x, car.y);
              cds[i].cd = 0.5;
            }
          });
          // 2本の交差点
          if (firing && ends.length === 2) {
            const [l1, l2] = ends;
            const d1x = l1.x1 - l1.x0;
            const d1y = l1.y1 - l1.y0;
            const d2x = l2.x1 - l2.x0;
            const d2y = l2.y1 - l2.y0;
            const den = d1x * d2y - d1y * d2x;
            if (Math.abs(den) > 1e-3) {
              const u = ((l2.x0 - l1.x0) * d2y - (l2.y0 - l1.y0) * d2x) / den;
              const v = ((l2.x0 - l1.x0) * d1y - (l2.y0 - l1.y0) * d1x) / den;
              if (u > 0 && u < 1 && v > 0 && v < 1) {
                const r = 6 + Math.sin(t * 40) * 2;
                g.fillStyle(0xffffff, 0.9).fillCircle(l1.x0 + d1x * u, l1.y0 + d1y * u, r);
              }
            }
          }
        },
        () => g.destroy(),
      );
    });
    release(e, world, 0.35 + windup + active);
    e.setEnemyState('windup', 0.35 + windup + active);
  },

  /** カラーチェンジ：赤が追いかけ、水色は反対側から追う。一定時間後に2台が高速で位置を入れ替える（入れ替わりにも当たる） */
  colorChange: (e, world, atk, power, windup) => {
    const c = e.partner;
    const p = world.player;
    const rounds = opt(atk, 'rounds', 2);
    const chase = opt(atk, 'chase', 2);
    const step = chase + windup + 0.3;
    for (let r = 0; r < rounds; r++) {
      later(e, world, r * step, () => {
        const cds = [{ cd: 0 }, { cd: 0 }];
        e.controlled = true;
        if (c) c.controlled = true;
        everyFrame(
          world,
          chase,
          (dt) => {
            // 赤はまっすぐ追い、水色はプレイヤーをはさんだ反対側へ
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            e.body.reset(e.x + Math.cos(a) * 55 * dt, e.y + Math.sin(a) * 55 * dt);
            e.setFlipX(Math.cos(a) < 0);
            contact(world, e, power * 0.6, cds[0], dt);
            if (c) {
              const tx = p.x - Math.cos(a) * 50;
              const ty = p.y - Math.sin(a) * 50;
              const b = Math.atan2(ty - c.y, tx - c.x);
              const d = Math.min(70 * dt, Math.hypot(tx - c.x, ty - c.y));
              c.body.reset(c.x + Math.cos(b) * d, c.y + Math.sin(b) * d);
              c.setFlipX(Math.cos(b) < 0);
              contact(world, c, power * 0.6, cds[1], dt);
            }
          },
          () => {
            if (!e.alive || !c) return;
            const ax = e.x;
            const ay = e.y;
            const bx = c.x;
            const by = c.y;
            world.showSpeech((ax + bx) / 2, (ay + by) / 2 - 10, 'チェンジ！');
            lineAoe(world, e, ax, ay, bx, by, 20, windup, power, 0, () => {
              drive(world, e, bx, by, 160, 'Linear');
              drive(world, c, ax, ay, 160, 'Linear');
            });
          },
        );
      });
    }
    release(e, world, rounds * step + 0.2);
    e.setEnemyState('windup', rounds * step + 0.2);
  },

  /** ツイン・スピン：2台が高速回転しながら左右から中央へ。中央で合体するように見え、最後に大爆発 */
  twinSpin: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const c = e.partner;
    const T = opt(atk, 'duration', 2.6);
    const sides = [-1, 1];
    const cars = [e, c].filter((x): x is Enemy => !!x);
    cars.forEach((car, i) => drive(world, car, A.x + sides[i] * (A.r - 10), A.y, 300, 'Quad.easeOut'));
    const cds = cars.map(() => ({ cd: 0 }));
    later(e, world, 0.35, () => {
      everyFrame(
        world,
        T,
        (dt, t) => {
          cars.forEach((car, i) => {
            const k = t / T;
            car.body.reset(A.x + sides[i] * (A.r - 10) * (1 - k), A.y + Math.sin(t * 5 + i * Math.PI) * 20 * (1 - k));
            car.setAngle(car.angle + (i === 0 ? 900 : -900) * dt);
            contact(world, car, power * 0.7, cds[i], dt);
          });
        },
        () => cars.forEach((car) => car.setAngle(0)),
      );
      world.spawnAoe({ x: A.x, y: A.y, angle: 0, shape: { type: 'circle', radius: 56 }, duration: T - 0.8, delay: 0.8, power: power * 1.5, owner: e, effect: 'finale' });
      later(e, world, T + 0.1, () => cars.forEach((car, i) => drive(world, car, A.x + sides[i] * 50, A.y, 300, 'Quad.easeOut')));
    });
    release(e, world, T + 0.8);
    e.setEnemyState('windup', Math.max(windup, T + 0.8));
  },

  /** 赤の轍・蒼の轍：2台がエリアを走り回る。赤の跡は炎（ダメージ）、水色の跡は水（遅くなる）。安全な場所がだんだん減る */
  twinTrails: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const c = e.partner;
    const T = opt(atk, 'duration', 5);
    const cars = [e, c].filter((x): x is Enemy => !!x);
    const targets = cars.map(() => ({ x: A.x, y: A.y, t: 0 }));
    const lastDrop = cars.map((car) => ({ x: car.x, y: car.y }));
    const cds = cars.map(() => ({ cd: 0 }));
    cars.forEach((car) => (car.controlled = true));
    everyFrame(world, T, (dt) => {
      cars.forEach((car, i) => {
        const tg = targets[i];
        tg.t -= dt;
        if (tg.t <= 0 || Math.hypot(tg.x - car.x, tg.y - car.y) < 6) {
          tg.x = A.x + (Math.random() * 2 - 1) * (A.r - 12);
          tg.y = A.y + (Math.random() * 2 - 1) * (A.h - 12);
          tg.t = 0.9;
        }
        const a = Math.atan2(tg.y - car.y, tg.x - car.x);
        car.body.reset(car.x + Math.cos(a) * 130 * dt, car.y + Math.sin(a) * 130 * dt);
        car.setFlipX(Math.cos(a) < 0);
        contact(world, car, power * 0.6, cds[i], dt);
        // 走った跡
        const ld = lastDrop[i];
        if (Math.hypot(car.x - ld.x, car.y - ld.y) >= 14) {
          ld.x = car.x;
          ld.y = car.y;
          if (i === 0) world.spawnHazard({ x: car.x, y: car.y + 4, radius: 9, duration: 7, power: power * 0.22, tick: 0.4 });
          else world.spawnWater(car.x, car.y + 4, 11, 7);
        }
      });
    });
    release(e, world, T);
    e.setEnemyState('windup', Math.max(windup, T + 0.2));
  },

  /** ダブルブレーキ：左右から突進し、プレイヤーの手前で急ブレーキ → 衝撃波。さらに後ろへ下がってもう一度 */
  doubleBrake: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const c = e.partner;
    const p = world.player;
    const px = p.x;
    const py = p.y;
    [e, c].forEach((car, i) => {
      if (!car) return;
      const side = i === 0 ? -1 : 1;
      const sx = A.x + side * (A.r + 4);
      const sy = clamp(py + side * 6, A.y - A.h, A.y + A.h);
      const stopX = px + side * 26;
      const stopY = py;
      const backX = stopX + side * 34;
      drive(world, car, sx, sy, 250, 'Quad.easeOut');
      later(e, world, 0.25, () => {
        lineAoe(world, e, sx, sy, stopX, stopY, 20, windup, power * 0.8, 0, () => drive(world, car, stopX, stopY, 160, 'Quad.easeOut'));
        world.spawnAoe({ x: stopX, y: stopY, angle: 0, shape: { type: 'circle', radius: 30 }, duration: windup + 0.35, power, owner: e, effect: 'meteor' });
        // 後ろに下がって、もう一度
        later(e, world, windup + 0.5, () => drive(world, car, backX, stopY, 250, 'Quad.easeOut'));
        world.spawnAoe({ x: backX, y: stopY, angle: 0, shape: { type: 'circle', radius: 38 }, duration: 0.8, delay: windup + 0.35, power, owner: e, effect: 'meteor' });
      });
    });
    release(e, world, windup + 1.5);
    e.setEnemyState('windup', windup + 1.5);
  },

  /** ツインホーミング：2台が赤と水色の追尾弾を大量に撃つ。弾どうしがぶつかると爆発 */
  twinHoming: (e, world, atk, power, windup) => {
    const c = e.partner;
    const p = world.player;
    const count = opt(atk, 'count', 5);
    [e, c].forEach((car, i) => {
      if (!car) return;
      for (let k = 0; k < count; k++) {
        later(e, world, windup * 0.4 + k * 0.15, () => {
          const base = Math.atan2(p.y - car.y, p.x - car.x);
          world.spawnProjectile({
            x: car.x,
            y: car.y,
            angle: base + (k / (count - 1) - 0.5) * 1.8,
            speed: 62,
            distance: 330,
            sprite: i === 0 ? 'fx_orb_red' : 'fx_orb_cyan',
            power: power * 0.7,
            hitRadius: 4,
            hostile: true,
            homing: 1.8,
            meetExplode: true,
          });
        });
      }
    });
    e.setEnemyState('windup', windup + count * 0.15);
  },

  /** オーバーテイク：片方がおとりになって追いかけ、もう片方が高速で横切る。役割を交代しながら続く */
  overtake: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const c = e.partner;
    const rounds = opt(atk, 'rounds', 5);
    const step = windup + 0.5;
    const p = world.player;
    const cds = [{ cd: 0 }, { cd: 0 }];
    let decoyIndex = 0;
    const cars = [e, c];
    e.controlled = true;
    if (c) c.controlled = true;
    // おとりはずっと追いかける
    everyFrame(world, rounds * step, (dt) => {
      const decoy = cars[decoyIndex];
      if (!decoy?.active) return;
      const a = Math.atan2(p.y - decoy.y, p.x - decoy.x);
      decoy.body.reset(decoy.x + Math.cos(a) * 58 * dt, decoy.y + Math.sin(a) * 58 * dt);
      decoy.setFlipX(Math.cos(a) < 0);
      contact(world, decoy, power * 0.6, cds[decoyIndex], dt);
    });
    for (let r = 0; r < rounds; r++) {
      later(e, world, r * step, () => {
        decoyIndex = r % 2;
        const runner = cars[1 - decoyIndex];
        if (!runner) return;
        const horizontal = Math.random() < 0.5;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const from = horizontal ? { x: A.x - dir * (A.r + 6), y: p.y } : { x: p.x, y: A.y - dir * (A.h + 6) };
        const to = horizontal ? { x: A.x + dir * (A.r + 6), y: p.y } : { x: p.x, y: A.y + dir * (A.h + 6) };
        runner.body.reset(from.x, from.y);
        lineAoe(world, e, from.x, from.y, to.x, to.y, 22, windup, power, 0, () => drive(world, runner, to.x, to.y, 170, 'Linear'));
      });
    }
    // 最後はエリアの中へ戻る
    later(e, world, rounds * step, () => {
      drive(world, e, A.x - 40, A.y - A.h * 0.5, 300, 'Quad.easeOut');
      if (c) drive(world, c, A.x + 40, A.y - A.h * 0.5, 300, 'Quad.easeOut');
    });
    release(e, world, rounds * step + 0.4);
    e.setEnemyState('windup', rounds * step + 0.4);
  },

  /** ツインメテオ：2台が高く跳び上がり、同時に着地して大爆発。爆発のあと衝撃波が外へ広がる */
  twinMeteor: (e, world, _atk, power, windup) => {
    const c = e.partner;
    const p = world.player;
    const scene = world.gameScene;
    const t1 = { x: p.x, y: p.y };
    // 着地点が重なるか、離れるかはランダム
    const apart = Math.random() < 0.6;
    const a = Math.random() * Math.PI * 2;
    const t2 = apart ? { x: p.x + Math.cos(a) * 64, y: p.y + Math.sin(a) * 64 } : { x: p.x + 10, y: p.y + 6 };
    [e, c].forEach((car, i) => {
      if (!car) return;
      const tg = i === 0 ? t1 : t2;
      // 跳び上がる
      drive(world, car, car.x, car.y - 90, 400, 'Quad.easeOut');
      scene.tweens.add({ targets: car, alpha: 0.2, duration: 400 });
      world.spawnAoe({
        x: tg.x,
        y: tg.y,
        angle: 0,
        shape: { type: 'circle', radius: 34 },
        duration: windup,
        power: power * 1.4,
        owner: e,
        effect: 'meteor',
        onResolve: () => {
          scene.tweens.killTweensOf(car);
          car.setAlpha(1);
          car.body.reset(tg.x, tg.y);
          scene.cameras.main.shake(250, 0.01);
          // 衝撃波（外へ広がる輪）
          world.spawnAoe({ x: tg.x, y: tg.y, angle: 0, shape: { type: 'ring', inner: 34, outer: 74 }, duration: 0.6, power: power * 0.7, owner: e });
        },
      });
      later(e, world, windup - 0.2, () => car.body.reset(tg.x, tg.y - 70));
    });
    release(e, world, windup + 1);
    e.setEnemyState('windup', windup + 1);
  },

  /**
   * ツイン・オーバードライブ（第二形態の終盤）：2台が画面から消え、横・縦・斜めの順に攻撃の線が増える。
   * 最後に2台が中央へ突進して大爆発。煙が晴れると、2台はプレイヤーの左右に並んでいる
   */
  twinOverdrive: (e, world, atk, power, windup) => {
    const A = rect(e, atk);
    const c = e.partner;
    const p = world.player;
    const scene = world.gameScene;
    const cars = [e, c].filter((x): x is Enemy => !!x);
    cars.forEach((car) => {
      car.controlled = true;
      scene.tweens.add({ targets: car, alpha: 0, duration: 300 });
    });
    world.showSpeech(A.x, A.y - A.h + 10, 'ツイン・オーバードライブ');
    const sprites = [e.texture.key, c?.texture.key ?? e.texture.key];
    const tints = [0xef7d57, 0x73eff7];
    const waves: number[][] = [
      [0, 0, 0],
      [Math.PI / 2, Math.PI / 2, Math.PI / 2],
      [Math.PI / 4, -Math.PI / 4, 0, Math.PI / 2],
    ];
    let t = 0.5;
    waves.forEach((angles) => {
      angles.forEach((a, k) => {
        later(e, world, t + k * 0.3, () => {
          // プレイヤーの位置と、その少し横を通る線
          const off = (k - (angles.length - 1) / 2) * 36;
          const px = p.x + Math.cos(a + Math.PI / 2) * off;
          const py = p.y + Math.sin(a + Math.PI / 2) * off;
          const { from, to } = lineThrough(A, px, py, a);
          lineAoe(world, e, from.x, from.y, to.x, to.y, 22, windup, power, 0, () => streak(world, sprites[k % 2], from.x, from.y, to.x, to.y, tints[k % 2]));
        });
      });
      t += angles.length * 0.3 + windup + 0.2;
    });
    // 最後：2台が中央へ突進して大爆発
    later(e, world, t, () => {
      cars.forEach((car, i) => {
        car.body.reset(A.x + (i === 0 ? -1 : 1) * (A.r + 10), A.y);
        car.setAlpha(1);
        drive(world, car, A.x, A.y, 1200, 'Quad.easeIn');
      });
      world.spawnAoe({ x: A.x, y: A.y, angle: 0, shape: { type: 'circle', radius: 64 }, duration: 1.2, power: power * 1.8, owner: e, effect: 'finale' });
    });
    // 煙が晴れると、2台はプレイヤーの左右に並んでいる
    later(e, world, t + 1.5, () => {
      world.showBlast(A.x, A.y, 60, 0x94b0c2);
      cars.forEach((car, i) => {
        car.setAlpha(0);
        car.body.reset(p.x + (i === 0 ? -24 : 24), p.y);
        car.setFlipX(i === 1);
        scene.tweens.add({ targets: car, alpha: 1, duration: 600, delay: 400 });
      });
    });
    release(e, world, t + 2.6);
    e.setEnemyState('windup', t + 2.6);
  },
};

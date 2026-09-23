import Phaser from 'phaser';
import type { SkillDef, SkillKind } from '../core/types';
import type { CombatWorld } from './CombatWorld';

// スキルの種類ごとの処理。新しい種類を増やすときは関数を追加して HANDLERS に登録する

export interface SkillCast {
  world: CombatWorld;
  skill: SkillDef;
  x: number;
  y: number;
  /** 向き（ラジアン） */
  angle: number;
  /** 装備などによる威力の倍率 */
  powerMul: number;
  /** 狙っている敵の位置（いなければ undefined） */
  targetX?: number;
  targetY?: number;
}

type SkillHandler = (cast: SkillCast) => void;

/** 扇形の近接攻撃 */
const meleeArc: SkillHandler = ({ world, skill, x, y, angle, powerMul }) => {
  const range = skill.range ?? 20;
  const halfArc = Phaser.Math.DegToRad((skill.arc ?? 120) / 2);

  if (skill.effect) {
    const fx = world.gameScene.add
      .sprite(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8, skill.effect, 0)
      .setRotation(angle)
      .setDepth(y + 20);
    let frame = 0;
    world.gameScene.time.addEvent({
      delay: 40,
      repeat: 2,
      callback: () => {
        frame++;
        if (frame > 2) fx.destroy();
        else fx.setFrame(frame);
      },
    });
  }

  for (const enemy of world.getLiveEnemies()) {
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > range + enemy.radius) continue;
    const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
    // 密着している敵は角度に関係なく当てる
    if (diff <= halfArc || dist < enemy.radius + 6) {
      world.damageEnemy(enemy, skill.power * powerMul, x, y);
    }
  }
};

/** 弾を撃つ（count 発を spread 度に広げて） */
const projectile: SkillHandler = ({ world, skill, x, y, angle, powerMul }) => {
  const p = skill.projectile!;
  const count = p.count ?? 1;
  const spread = Phaser.Math.DegToRad(p.spread ?? 0);
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? angle : angle + spread * (i / (count - 1) - 0.5);
    world.spawnProjectile({
      x: x + Math.cos(a) * 8,
      y: y + Math.sin(a) * 8,
      angle: a,
      speed: p.speed,
      distance: p.distance,
      sprite: p.sprite,
      power: skill.power * powerMul,
      pierce: p.pierce,
      hitRadius: p.hitRadius,
      explodeRadius: p.explodeRadius,
      color: skill.color,
    });
  }
};

/** 狙った場所を、予兆のあと範囲攻撃（strikes 回、scatter の範囲に散らばる） */
const area: SkillHandler = ({ world, skill, x, y, angle, powerMul, targetX, targetY }) => {
  const scene = world.gameScene;
  const cx = targetX ?? x + Math.cos(angle) * 50;
  const cy = targetY ?? y + Math.sin(angle) * 50;
  const radius = skill.radius ?? 20;
  const color = skill.color ?? 0xffffff;
  const strikes = skill.strikes ?? 1;
  const scatter = skill.scatter ?? 0;

  for (let i = 0; i < strikes; i++) {
    const ang = Math.random() * Math.PI * 2;
    const d = i === 0 && strikes > 1 ? 0 : Math.random() * scatter;
    const sx = cx + Math.cos(ang) * d;
    const sy = cy + Math.sin(ang) * d;
    const startDelay = i * 120;
    scene.time.delayedCall(startDelay, () => {
      // 予兆の円
      const mark = scene.add
        .circle(sx, sy, radius, color, 0.12)
        .setStrokeStyle(1, color, 0.8)
        .setDepth(sy - 5);
      scene.tweens.add({ targets: mark, alpha: 0.5, duration: (skill.delay ?? 0.3) * 1000 });
      scene.time.delayedCall((skill.delay ?? 0.3) * 1000, () => {
        mark.destroy();
        world.damageArea(sx, sy, radius, skill.power * powerMul);
        world.showBlast(sx, sy, radius, color);
      });
    });
  }
};

/** 自分の周囲を攻撃 */
const nova: SkillHandler = ({ world, skill, x, y, powerMul }) => {
  const radius = skill.radius ?? 30;
  world.damageArea(x, y, radius, skill.power * powerMul);
  world.showBlast(x, y, radius, skill.color ?? 0xffffff);
};

/** 突進（処理は Player 側。触れた敵にダメージ） */
const dash: SkillHandler = ({ world, skill, angle, powerMul }) => {
  world.player.startDash(angle, skill, powerMul);
};

/** 一定時間の強化 */
const buff: SkillHandler = ({ world, skill }) => {
  if (skill.buff) world.player.addBuff(skill.buff.stats, skill.buff.duration, skill.color ?? 0xffffff);
  world.showBlast(world.player.x, world.player.y, 18, skill.color ?? 0xffffff);
};

const HANDLERS: Record<SkillKind, SkillHandler> = {
  meleeArc,
  projectile,
  area,
  nova,
  dash,
  buff,
};

export function runSkill(cast: SkillCast): void {
  HANDLERS[cast.skill.kind](cast);
}

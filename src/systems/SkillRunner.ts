import Phaser from 'phaser';
import type { SkillDef, SkillKind } from '../core/types';
import type { CombatWorld } from './CombatWorld';

export interface SkillCast {
  world: CombatWorld;
  skill: SkillDef;
  x: number;
  y: number;
  /** 向き（ラジアン） */
  angle: number;
}

type SkillHandler = (cast: SkillCast) => void;

/** 扇形の近接攻撃 */
const meleeArc: SkillHandler = ({ world, skill, x, y, angle }) => {
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
      world.damageEnemy(enemy, skill.power, x, y);
    }
  }
};

const HANDLERS: Record<SkillKind, SkillHandler> = {
  meleeArc,
};

export function runSkill(cast: SkillCast): void {
  HANDLERS[cast.skill.kind](cast);
}

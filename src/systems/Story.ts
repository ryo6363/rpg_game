import { LOOP } from '../config/balance';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import type { DialogLine, StoryEventDef, StoryTrigger } from '../core/types';
import { STORY_EVENTS } from '../data/story';

// ストーリー進行（フラグ・周回・イベントの判定）

export function currentLoop(): number {
  return gameState.story.loop;
}

export function hasFlag(flag: string): boolean {
  return gameState.story.flags.includes(flag);
}

export function setFlag(flag: string) {
  if (!hasFlag(flag)) gameState.story.flags.push(flag);
}

/** 周回数に合わない台詞を除く */
export function linesForLoop(lines: DialogLine[]): DialogLine[] {
  const loop = currentLoop();
  return lines.filter((l) => (l.minLoop ?? 1) <= loop && loop <= (l.maxLoop ?? Infinity));
}

function sameTrigger(a: StoryTrigger, b: StoryTrigger): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'areaEnter':
      return a.area === (b as typeof a).area;
    case 'talk':
      return a.npc === (b as typeof a).npc;
    case 'touch':
      return a.object === (b as typeof a).object;
    case 'bossPhase':
      return a.boss === (b as typeof a).boss && a.phase === (b as typeof a).phase;
    case 'bossDefeated':
      return a.boss === (b as typeof a).boss;
  }
}

/** このきっかけで今起こるべきイベント（なければ undefined） */
export function findEvent(trigger: StoryTrigger): StoryEventDef | undefined {
  const loop = currentLoop();
  return STORY_EVENTS.find(
    (ev) =>
      sameTrigger(ev.trigger, trigger) &&
      (ev.minLoop ?? 1) <= loop &&
      loop <= (ev.maxLoop ?? Infinity) &&
      (ev.requires ?? []).every(hasFlag) &&
      !(ev.unless ?? [ev.id]).some(hasFlag),
  );
}

/** イベントを終えたときのフラグ処理 */
export function completeEvent(ev: StoryEventDef) {
  setFlag(ev.id);
  for (const f of ev.setFlags ?? []) setFlag(f);
  SaveManager.save();
}

/** 周回を進める。フラグは消え、第1章の最初から。レベル・装備はそのまま */
export function startNextLoop() {
  gameState.story.loop++;
  gameState.story.chapter = 1;
  gameState.story.flags = [];
  SaveManager.save();
}

/** 周回を反映した敵レベル */
export function enemyLevel(areaLevel: number): number {
  return areaLevel + (currentLoop() - 1) * LOOP.levelPerLoop;
}

/** 周回を反映したレア以上の出やすさ */
export function rarityBonus(): number {
  return 1 + (currentLoop() - 1) * LOOP.rarityBonusPerLoop;
}

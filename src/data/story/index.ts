import type { StoryEventDef } from '../../core/types';
import { CHAPTER1_EVENTS } from './chapter1';
import { CHAPTER2_EVENTS } from './chapter2';
import { CHAPTER3_EVENTS } from './chapter3';

// 章ごとのストーリーイベントをまとめる。第3章以降はファイルを足してここに並べる
export const STORY_EVENTS: StoryEventDef[] = [...CHAPTER1_EVENTS, ...CHAPTER2_EVENTS, ...CHAPTER3_EVENTS];

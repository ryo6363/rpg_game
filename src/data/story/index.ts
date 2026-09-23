import type { StoryEventDef } from '../../core/types';
import { CHAPTER1_EVENTS } from './chapter1';
import { CHAPTER2_EVENTS } from './chapter2';

// 章ごとのストーリーイベントをまとめる。第3章以降はファイルを足してここに並べる
export const STORY_EVENTS: StoryEventDef[] = [...CHAPTER1_EVENTS, ...CHAPTER2_EVENTS];

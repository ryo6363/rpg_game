import type { ChapterDef } from '../core/types';

// 章の一覧。available: false の章は「準備中」として表示される。
// 最終章（next なし）をクリアすると周回（ループ）に入る。

export const CHAPTERS: Record<number, ChapterDef> = {
  1: { id: 1, title: 'はじまりの森', subtitle: '道の向こう側', next: 2, available: true, startArea: 'town' },
  2: { id: 2, title: '灰の都', subtitle: '失われた記憶', next: 3, available: true, startArea: 'ash_city' },
  3: { id: 3, title: '沈んだ世界', subtitle: '過去の自分', next: 4, available: true, startArea: 'port_town' },
  4: { id: 4, title: '終焉王国', subtitle: 'ループの真実', next: 5, available: true, startArea: 'fortress_town' },
  5: { id: 5, title: '世界の果て', subtitle: '最後のドライブ', available: true, startArea: 'world_end' },
};

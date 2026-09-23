import type { StoryEventDef } from '../../core/types';

// 第2章「灰の都」のストーリーイベント。
// s = 話者（省略でナレーション）。minLoop / maxLoop で周回ごとに台詞を変えられる。

const ME = '主人公';
const BOSS = '終焉騎士グラディオン';
const CLERK = '店員';
const NAVI = 'ナビ';

export const CHAPTER2_EVENTS: StoryEventDef[] = [
  // ---------------------------------------------------------------- 灰の都に着く
  {
    id: 'ch2_arrive',
    trigger: { type: 'areaEnter', area: 'ash_city' },
    lines: [
      { t: '第2章「灰の都」' },
      { t: '灰色の空の下に、巨大な都市が広がっている。' },
      { t: '街の中央には、塔のような大時計。針のかわりに、数字がひとつだけ浮かんでいる。' },
      { t: '「 5 」' },
      { s: ME, t: '5……。森の車に刻まれていた数字と同じだ。' },
      { s: NAVI, t: '目的地に到着しました。' },
      { s: ME, t: '……ここで何をしろっていうんだ。' },
    ],
  },

  // ---------------------------------------------------------------- 昨日を覚えていない人々
  {
    id: 'clerk_first',
    trigger: { type: 'talk', npc: 'clerk' },
    lines: [
      { s: CLERK, t: 'いらっしゃいませ！ 旅の方ですね。' },
      { s: CLERK, t: '北の高速道路ですか？ あそこは危ないですよ。もう何年も誰も通っていません。' },
      { s: ME, t: 'ありがとう。また寄るよ。' },
      { s: CLERK, t: 'はい、お待ちしてます！' },
    ],
  },
  {
    // 高速道路へ一度行って戻ってくると……
    id: 'clerk_forget',
    trigger: { type: 'talk', npc: 'clerk' },
    requires: ['clerk_first', 'ch2_highway'],
    lines: [
      { s: CLERK, t: 'いらっしゃいませ！ 初めまして！' },
      { s: ME, t: '……さっき話したよな？' },
      { s: CLERK, t: '？ 初めまして、ですよ？' },
      { t: '店員は、本当に何も覚えていないようだった。' },
      { s: ME, t: '（この街の人たちは……昨日のことを覚えていない？）' },
    ],
  },

  // ---------------------------------------------------------------- 廃高速道路
  {
    id: 'ch2_highway',
    trigger: { type: 'areaEnter', area: 'ch2_field1' },
    lines: [
      { t: 'ひび割れたアスファルトが、どこまでも続いている。' },
      { s: ME, t: 'ここが廃高速道路か。……空気が重いな。' },
    ],
  },
  {
    id: 'rust_fits',
    trigger: { type: 'touch', object: 'rust_fits' },
    lines: [
      { t: '道路のあちこちに、朽ち果てた車が並んでいる。' },
      { s: ME, t: '……全部、FITだ。' },
      { t: 'どれも、主人公の車とまったく同じ型だった。' },
      { t: '錆びたフロントガラスには、かすれた数字……「5」。' },
      { s: ME, t: '森の車だけじゃない。こんなに……どうして……。' },
      { s: ME, t: '……前の周回でも、ここに並んでいた気がする。', minLoop: 2 },
    ],
  },

  // ---------------------------------------------------------------- ボス
  {
    id: 'ch2_boss_intro',
    trigger: { type: 'areaEnter', area: 'ch2_boss' },
    unless: ['ch2_boss_intro', 'ch2_boss'],
    lines: [
      { t: '高速道路の終点。巨大な鎧騎士が立ちはだかる。' },
      { t: '剣と盾。背中には、四輪型の魔導装置。' },
      { s: BOSS, t: '…………。' },
    ],
  },
  {
    id: 'gradion_hit',
    trigger: { type: 'bossHit', boss: 'gradion' },
    lines: [
      { s: BOSS, t: 'なぜ……また来た。' },
      { s: ME, t: '俺を知っているのか？' },
      { s: BOSS, t: '知っているとも。' },
      { s: BOSS, t: 'お前は……何度目だ？' },
      { s: BOSS, t: '……今回は、少し早いな。', minLoop: 2 },
    ],
  },
  {
    id: 'gradion_last',
    trigger: { type: 'bossPhase', boss: 'gradion', phase: 4 },
    lines: [
      { t: 'グラディオンが、剣を高く掲げた。' },
      { s: BOSS, t: 'ならば、断つ。この輪廻ごと――！' },
    ],
  },
  {
    id: 'ch2_boss',
    trigger: { type: 'bossDefeated', boss: 'gradion' },
    lines: [
      { s: BOSS, t: '次は……もっと早く……' },
      { t: '鎧が崩れ、光の粒になって消えていく。' },
      { s: ME, t: 'もっと早く……？ どういう意味だ……。' },
      { t: '……灰の都へ戻ろう。' },
    ],
  },

  // ---------------------------------------------------------------- 第2章ラスト
  {
    id: 'clock_change',
    trigger: { type: 'areaEnter', area: 'ash_city' },
    requires: ['ch2_boss'],
    lines: [
      { t: '街へ戻ると――' },
      { t: '中央の大時計が、ゆっくりと動いた。' },
    ],
    setFlags: ['clock_4'],
  },
  {
    id: 'ch2_clear',
    trigger: { type: 'areaEnter', area: 'ash_city' },
    requires: ['clock_change'],
    lines: [
      { t: '「 5 」 → 「 4 」' },
      { s: ME, t: '……数字が、減った？' },
      { s: '住民', t: '時計？ あれはずっと「4」だったよ。' },
      { s: ME, t: '（誰も気づいていない。変わったのが分かるのは……俺だけだ）' },
      { s: NAVI, t: '次の目的地を検索しています……。' },
    ],
    then: { type: 'chapterClear' },
  },
  {
    // クリア後：店員から周回をはじめられる
    id: 'ch2_loop_offer',
    trigger: { type: 'talk', npc: 'clerk' },
    requires: ['ch2_clear'],
    unless: [],
    lines: [
      { s: CLERK, t: 'いらっしゃいませ！ 初めまして！' },
      { s: CLERK, t: '……お客さん、なんだか「はじまり」の匂いがしますね。' },
    ],
    then: { type: 'chapterClear' },
  },
];

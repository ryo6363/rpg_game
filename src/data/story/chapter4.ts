import type { StoryEventDef } from '../../core/types';

// 第4章「終焉王国」のストーリーイベント。
// この章で「世界が何度も繰り返されている」ことをはっきり示す。
// ただし、誰が・なぜループを作ったのかは最終章まで明かさない。

const ME = '主人公';
const BOSS = '輪廻王クロノス';
const ELDER = '老人';
const NAVI = 'ナビ';
const GUARD = '門番';

export const CHAPTER4_EVENTS: StoryEventDef[] = [
  // ---------------------------------------------------------------- 城塞都市エンデに着く
  {
    id: 'ch4_arrive',
    trigger: { type: 'areaEnter', area: 'fortress_town' },
    lines: [
      { t: '第4章「終焉王国」' },
      { t: '見上げるほどの城壁に囲まれた、巨大な城塞都市。' },
      { t: '門の上の時計塔には、針が一本もない。' },
      { s: NAVI, t: '目的地に到着しました。' },
      { s: GUARD, t: 'お、帰ってきたか。今回はずいぶん早かったな。' },
      { s: ME, t: '……人違いだろ。俺がこの街に来るのは初めてだ。' },
      { s: GUARD, t: 'ははっ。あんたは毎回そう言うんだよな。' },
    ],
  },

  // ---------------------------------------------------------------- 主人公を知っている人々
  {
    id: 'guard_talk',
    trigger: { type: 'talk', npc: 'guard' },
    lines: [
      { s: GUARD, t: '今回は何周目だ？ ……いや、聞いても覚えてないんだったな。' },
      { s: ME, t: '周目……？ 何の話だ。' },
      { s: GUARD, t: '気にすんな。あの広場のじいさんに会っていけよ。あんた、いつもそうしてる。' },
    ],
  },
  {
    id: 'lady_talk',
    trigger: { type: 'talk', npc: 'lady' },
    lines: [
      { s: '婦人', t: 'あら、FIT の旅人さん。今回もいらしたのね。' },
      { s: ME, t: '……俺を知ってるのか？' },
      { s: '婦人', t: '知ってるも何も。前に来たときは、雨の日だったかしら。それとも、その前？' },
      { s: ME, t: '（誰も彼も……俺を知ってる）' },
    ],
  },
  {
    id: 'kid_talk',
    trigger: { type: 'talk', npc: 'fortress_kid' },
    lines: [
      { s: '子ども', t: 'FIT のお兄ちゃん！ また来たんだ！' },
      { s: '子ども', t: 'ねえねえ、今度は王さまに勝てる？ いつも負けちゃうんでしょ？' },
      { s: ME, t: '……いつも？' },
    ],
  },
  {
    id: 'ch4_elder',
    trigger: { type: 'talk', npc: 'rinne_elder' },
    lines: [
      { s: ELDER, t: '……来たか。' },
      { s: ME, t: 'あんたも俺を知ってるのか。言っておくが、俺はこの街に来たのは初めてだ。' },
      { s: ELDER, t: 'ああ。今回のお前は、そう言う。' },
      { s: ME, t: '……今回の？' },
      { s: ELDER, t: '前のお前は「思い出した」と言った。その前のお前は、何も言わずに王国へ向かった。' },
      { s: ELDER, t: 'お前は何度もこの街に来ておる。そして何度も、同じ道を走っていく。' },
      { s: ME, t: '……冗談だろ。' },
      { s: ELDER, t: '信じられんなら、広場の祭壇に、お前の持っている「結晶」をかざしてみるといい。' },
      { s: ME, t: '（記憶の結晶のことか……？ どうしてこの人が知ってるんだ）' },
    ],
  },
  {
    id: 'scholar_talk',
    trigger: { type: 'talk', npc: 'scholar' },
    lines: [
      { s: '学者', t: '北の終焉街道の先に、滅びた王国がある。' },
      { s: '学者', t: '王国の中心、玉座の間には「終焉王」がいるという。' },
      { s: '学者', t: 'この世界の始まりも、終わりも……終焉王がすべてを知っている、と。' },
      { s: ME, t: '終焉王……。' },
    ],
  },

  // ---------------------------------------------------------------- 祭壇と記憶の結晶
  {
    // 老人と話す前：何度でも見られる
    id: 'altar_hint',
    trigger: { type: 'touch', object: 'crystal_altar' },
    unless: ['ch4_elder'],
    lines: [{ t: '古い祭壇。中央に、何かをかざすくぼみがある。' }],
  },
  {
    id: 'ch4_altar',
    trigger: { type: 'touch', object: 'crystal_altar' },
    requires: ['ch4_elder'],
    lines: [
      { t: '記憶の結晶を、祭壇のくぼみにかざした。' },
      { t: '結晶が、脈打つように光り出す――' },
    ],
    then: { type: 'flashback', variant: 'fortress', cut: true },
  },
  {
    id: 'ch4_altar_after',
    trigger: { type: 'touch', object: 'crystal_altar' },
    requires: ['ch4_altar'],
    lines: [
      { t: '……映っていたのは、この城塞都市だった。' },
      { t: '同じ門。同じ時計塔。そして、同じ FIT と、同じ自分。' },
      { s: ME, t: '俺が……ここに来てる。今と、まったく同じように。' },
      { s: ME, t: 'でも、その先は……？ どうして途切れたんだ。' },
      { s: NAVI, t: '記録の続きは、破損しています。' },
      { s: NAVI, t: '……続きは、王国の中心に。' },
      { s: ME, t: '（ナビは……何を知ってるんだ？）' },
    ],
  },

  // ---------------------------------------------------------------- 終焉街道
  {
    id: 'ch4_road',
    trigger: { type: 'areaEnter', area: 'ch4_field1' },
    lines: [
      { t: '終焉街道。どこまでも続く、巨大な道路。' },
      { t: '両脇には崩れた城壁と、打ち捨てられた車。倒れかけた兵士の像が、道の先を見つめている。' },
      { s: NAVI, t: 'この道を走行するのは、……回目です。' },
      { s: ME, t: '……今、何回目って言った？' },
      { s: NAVI, t: 'ルートを案内します。' },
    ],
  },
  {
    id: 'statue_read',
    trigger: { type: 'touch', object: 'statue' },
    lines: [
      { t: '兵士の像。台座に文字が刻まれている。' },
      { t: '『輪廻の旅人に、道をあけよ。王は、その者を待っている』' },
    ],
  },
  {
    id: 'mural_loop1',
    trigger: { type: 'touch', object: 'mural_loop1' },
    lines: [
      { t: '城壁に、壁画が描かれている。' },
      { t: 'FIT と、運転席の人物。……沈没都市で見たものと、まったく同じ絵だ。' },
      { t: 'その横に、刻み目がびっしりと並んでいる。' },
      { s: ME, t: 'これ……数を数えてるのか？ 何の数だ……。' },
      { s: NAVI, t: '走行記録と一致します。' },
    ],
  },
  {
    id: 'record_1',
    trigger: { type: 'touch', object: 'record_1' },
    lines: [
      { t: '古い石板の記録。' },
      { t: '『FIT に乗った旅人が、王国に到着した。』' },
      { t: '『旅人は王に挑み、そして――世界は、はじめに戻った。』' },
      { t: '『これで、三十七度目の記録となる。』' },
      { s: ME, t: '三十七……。世界が、はじめに戻った……？' },
      { s: ME, t: '（……数字が、前に見たときより増えている気がする）', minLoop: 2 },
    ],
  },

  // ---------------------------------------------------------------- 終焉王国
  {
    id: 'ch4_kingdom',
    trigger: { type: 'areaEnter', area: 'ch4_field2' },
    lines: [
      { t: '滅びた王国の城内。赤い絨毯だけが、玉座の方角へまっすぐ伸びている。' },
      { t: '壁にも床にも、時計の文字盤の模様が刻まれている。' },
    ],
  },
  {
    id: 'mural_loop2',
    trigger: { type: 'touch', object: 'mural_loop2' },
    lines: [
      { t: 'また、同じ壁画。' },
      { t: 'いや……よく見ると、少しずつ違う。車の傷の位置。運転手の表情。' },
      { t: '何枚も、何枚も。同じ旅を、何度も描き直したように。' },
      { s: ME, t: '全部……俺なのか。' },
    ],
  },
  {
    id: 'record_2',
    trigger: { type: 'touch', object: 'record_2' },
    lines: [
      { t: '石板の記録。筆跡が、ほかの記録と違う。' },
      { t: '『次の自分へ。王の言葉を信じるな。……いや、信じてもいい。どちらでも、結末は同じだ。』' },
      { s: NAVI, t: '筆跡を照合しています……一致しました。' },
      { s: NAVI, t: 'この記録は、あなたが書いたものです。' },
      { s: ME, t: '……俺は、こんなものを書いた覚えはない。' },
      { s: NAVI, t: 'はい。あなたは、覚えていません。' },
      { s: ME, t: '（ナビは……俺より前のことを覚えている？）' },
    ],
  },

  // ---------------------------------------------------------------- ボス
  {
    id: 'ch4_boss_intro',
    trigger: { type: 'areaEnter', area: 'ch4_boss' },
    unless: ['ch4_boss_intro', 'ch4_boss'],
    lines: [
      { t: '玉座の間。静まり返った広間に、時計の音だけが響いている。' },
      { t: '玉座から、黒と金の鎧をまとった王が立ち上がった。' },
      { t: '背中には巨大な時計盤。右手に大剣。左腕の装置が、青白く光っている。' },
      { s: BOSS, t: '……また来たか。' },
    ],
  },
  {
    id: 'chronos_hit',
    trigger: { type: 'bossHit', boss: 'chronos' },
    lines: [
      { s: ME, t: '「また」って何だ。俺は、初めてここに来た。' },
      { s: BOSS, t: 'そう思っているのは、お前だけだ。' },
      { s: BOSS, t: '我は覚えている。お前が剣を向けた数も、倒れた数も、この玉座にたどり着いた数も。' },
      { s: BOSS, t: '……今回は、少し目つきが違うな。', minLoop: 2 },
    ],
  },
  {
    id: 'chronos_p2',
    trigger: { type: 'bossPhase', boss: 'chronos', phase: 2 },
    lines: [{ s: BOSS, t: '時を戻そう。何度でも。……お前が、そうしてきたようにな。' }],
  },
  {
    id: 'chronos_p3',
    trigger: { type: 'bossPhase', boss: 'chronos', phase: 3 },
    lines: [
      { s: BOSS, t: '見よ。お前がこれまで越えてきた者たちだ。' },
      { s: BOSS, t: '森の獣も、灰の騎士も、深海の竜も――すべて、お前の輪廻の中にいる。' },
    ],
  },
  {
    id: 'chronos_last',
    trigger: { type: 'bossPhase', boss: 'chronos', phase: 4 },
    lines: [
      { s: BOSS, t: '教えてやろう、旅人よ。' },
      { s: BOSS, t: 'お前自身が、この輪廻を望んだのだ。' },
      { s: ME, t: '……俺が？ どういうことだ！' },
      { s: BOSS, t: 'それを知りたければ、この時計を越えてみせよ――終焉時計！' },
    ],
  },
  {
    id: 'ch4_boss',
    trigger: { type: 'bossDefeated', boss: 'chronos' },
    lines: [
      { s: BOSS, t: '……見事だ。だが、これで終わりではない。' },
      { s: BOSS, t: '時計が止まれば、世界もまた……止まる。' },
      { s: BOSS, t: 'その先で、お前は……自分の選んだものと、向き合うことになる……。' },
    ],
    then: { type: 'clockBreak' },
  },
  {
    id: 'ch4_timestop',
    trigger: { type: 'bossDefeated', boss: 'chronos' },
    requires: ['ch4_boss'],
    lines: [
      { t: '玉座の間の巨大な時計が、音を立てて砕け散った。' },
      { t: '――音が、消えた。' },
      { t: '舞い上がった埃も、崩れかけた柱も、空中で止まっている。' },
      { s: ME, t: '時間が……止まった？' },
      { s: NAVI, t: '……城塞都市へ、帰還します。' },
    ],
    then: { type: 'goTo', area: 'fortress_town', arrive: 's' },
  },

  // ---------------------------------------------------------------- 世界の崩壊
  {
    id: 'ch4_return',
    trigger: { type: 'areaEnter', area: 'fortress_town' },
    requires: ['ch4_boss'],
    lines: [
      { t: '城塞都市。' },
      { t: '人々は、話しかけた姿勢のまま、歩きかけた姿勢のまま、固まっている。' },
      { t: '噴水の水しぶきも、空を飛ぶ鳥も、すべてが止まっている。' },
      { s: ME, t: '街まで……全部止まってる。' },
      { t: '――その時。足元が、かすかに揺れた。' },
    ],
    then: { type: 'collapse' },
  },
  {
    id: 'ch4_clear',
    trigger: { type: 'areaEnter', area: 'fortress_town' },
    requires: ['ch4_return'],
    lines: [
      { t: '街が、道路が、建物が――光の粒になって、空へ溶けていく。' },
      { t: '人も、城壁も、時計塔も。何もかもが、消えていく。' },
      { t: '残ったのは、FIT だけだった。' },
      { t: 'ピッ――。誰も触れていないのに、ナビが起動した。' },
      { s: NAVI, t: '最終目的地を設定します。' },
      { s: ME, t: 'どこだ？' },
      { s: NAVI, t: '世界の果て。' },
    ],
    then: { type: 'titleCard', title: '最終章', subtitle: '世界の果て', area: 'world_end' },
  },

  // ---------------------------------------------------------------- 世界の果て（最終章の入口）
  {
    id: 'world_end_arrive',
    trigger: { type: 'areaEnter', area: 'world_end' },
    lines: [
      { t: '何もない。' },
      { t: '空も、地面も、音もない。ただ一本の道路だけが、暗闇の中へまっすぐ伸びている。' },
      { s: NAVI, t: '目的地まで、あと……計測できません。' },
      { s: ME, t: '……行くしかないか。' },
    ],
  },
  {
    // 最終章は準備中：道の終わりで、第4章のクリア画面（周回できる）
    id: 'road_end',
    trigger: { type: 'touch', object: 'road_end' },
    unless: [],
    lines: [
      { t: '道路は、そこで途切れていた。' },
      { t: 'その先には、まだ何もない。' },
      { s: NAVI, t: 'ルートを生成しています……しばらくお待ちください。' },
      { t: '（最終章「世界の果て」は準備中です）' },
    ],
    then: { type: 'chapterClear', chapter: 4 },
  },
];

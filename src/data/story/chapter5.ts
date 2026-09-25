import type { StoryEventDef } from '../../core/types';

// 最終章「世界の果て」のストーリーイベント。
// 第1〜4章の伏線を回収する：FIT は時間を巻き戻す装置で、ループを始めたのは過去の主人公自身だった。
// 最後に ZERO（過去の主人公が残した FIT）を倒し、自分の選択でループを終わらせる。

const ME = '主人公';
const PAST = '過去の主人公';
const NAVI = 'ナビ';
const ZERO = 'ZERO';
const RED = '赤い FIT';
const CYAN = '水色の FIT';

export const CHAPTER5_EVENTS: StoryEventDef[] = [
  // ---------------------------------------------------------------- 世界の果て
  {
    id: 'world_end_arrive',
    trigger: { type: 'areaEnter', area: 'world_end' },
    lines: [
      { t: '最終章「世界の果て」' },
      { t: '空も、地面もない。道路だけが、何本も空中に浮かんでつながっている。' },
      { t: 'まわりには、見覚えのある景色のかけらが漂っている。森、灰の都、沈んだ街、王国……。' },
      { s: NAVI, t: '時間の整合性が失われています。過去と現在の地形が、混ざっています。' },
      { s: ME, t: '……道が、ところどころ消えかけてる。気をつけないとな。' },
      { s: NAVI, t: '目的地まで、あと……計測できません。' },
    ],
  },
  {
    id: 'old_fit',
    trigger: { type: 'touch', object: 'old_fit' },
    lines: [
      { t: '空中の小さな島に、一台の古い FIT が止まっていた。' },
      { s: ME, t: '……また、この車か。' },
      { t: '色あせたボディに、手を触れた瞬間――' },
    ],
    then: {
      type: 'flashback',
      variant: 'ruin',
      captions: [
        '崩れていく空の下を、FIT が走っている。',
        '運転しているのは――自分だった。',
        `${PAST}「このままでは、世界が終わる」`,
        `${PAST}「間に合わせる。……今度こそ」`,
      ],
    },
  },
  {
    id: 'old_fit_after',
    trigger: { type: 'touch', object: 'old_fit' },
    requires: ['old_fit'],
    lines: [
      { s: ME, t: '俺は……世界が滅びることを知っていた？' },
      { s: NAVI, t: '記録の続きは、この先にあります。' },
    ],
  },

  // ---------------------------------------------------------------- 記憶の回廊：FIT の正体
  {
    id: 'ch5_lab',
    trigger: { type: 'areaEnter', area: 'ch5_field2' },
    lines: [
      { t: '時間の裂け目の先に、空中に浮かぶ古い施設があった。' },
      { t: '壁一面に、道路の地図のような模様が刻まれている。' },
    ],
  },
  {
    id: 'reconstructor',
    trigger: { type: 'touch', object: 'reconstructor' },
    lines: [
      { t: '施設の中央に、FIT とまったく同じ形をした装置がある。' },
      { t: 'ピッ――。ナビが、ひとりでに起動した。' },
      { s: NAVI, t: '旧式世界再構築システムを確認。' },
      { s: ME, t: '世界再構築……？' },
      { s: NAVI, t: '世界崩壊時、時間を一定地点まで巻き戻すためのシステムです。' },
      { s: NAVI, t: 'あなたの FIT は、このシステムの最終型です。' },
      { s: ME, t: 'FIT が……時間を巻き戻す装置……？' },
      { s: NAVI, t: 'はい。「はじまりの森」は、巻き戻すたびに戻る地点です。' },
      { s: ME, t: '（森の古い車も、高速道路の朽ちた FIT も……巻き戻すたびに、残されてきたものだったのか）' },
    ],
  },

  // ---------------------------------------------------------------- 記録の深淵：主人公の真実
  {
    id: 'ch5_deep',
    trigger: { type: 'areaEnter', area: 'ch5_field3' },
    lines: [
      { t: '奥へ進むほど、記憶がはっきりしてくる。' },
      { t: 'この道も、浮かんでいる景色も……全部、知っている。' },
    ],
  },
  {
    id: 'last_record',
    trigger: { type: 'touch', object: 'last_record' },
    lines: [
      { t: '古い端末に、映像の記録が残っている。' },
      { s: NAVI, t: '記録を再生します。' },
    ],
    then: {
      type: 'flashback',
      variant: 'record',
      captions: [
        `${PAST}「この世界を救う方法は、ひとつしかない」`,
        `${PAST}「世界が終わる直前まで、戻る」`,
        `${PAST}「ただし、戻った俺は記憶を失う」`,
        `${PAST}「それでもいい」`,
        `${PAST}「いつか、世界を救えるまで」`,
      ],
    },
  },
  {
    id: 'last_record_after',
    trigger: { type: 'touch', object: 'last_record' },
    requires: ['last_record'],
    lines: [
      { s: ME, t: '……俺が、このループを始めたのか。' },
      { s: NAVI, t: 'はい。あなたは世界の崩壊を防ぐため、FIT で時間を巻き戻しました。' },
      { s: NAVI, t: 'けれど、一度では救えなかった。だから、何度も同じ時間を繰り返してきました。' },
      { s: NAVI, t: '巻き戻すたびに、あなたの記憶は消えます。消えた記憶は、すべて FIT に残りました。' },
      { s: NAVI, t: '森の獣も、灰の騎士も、深海の竜も……ループの残骸から生まれた存在です。' },
      { s: NAVI, t: 'クロノスは、ループを保つための管理者でした。' },
      { s: ME, t: 'それでも、世界は救えなかった……。' },
      { s: NAVI, t: 'はい。残された方法は、ひとつだけです。' },
      { s: NAVI, t: 'ループそのもの――「ZERO」を止めること。' },
    ],
  },

  // ---------------------------------------------------------------- 最終ボス ZERO
  {
    id: 'ch5_boss_intro',
    trigger: { type: 'areaEnter', area: 'ch5_boss' },
    unless: ['ch5_boss_intro', 'defeated_zero'],
    lines: [
      { t: '道路の終わり。空中に浮かぶ、狭い道の上。' },
      { t: 'そこに、黒い FIT が待っていた。' },
      { t: '主人公の FIT より、ひとまわり大きい。車体は黒い金属と光でできていて、まわりに無数の残像が浮かんでいる。' },
      { s: NAVI, t: '……ZERO。過去のあなたが、最後に残した FIT です。' },
      { s: ZERO, t: 'ここまで来たのですね。' },
      { s: ZERO, t: '私は、あなたを守るために作られました。何度倒れても、あなたを「はじまり」へ戻すために。' },
      { s: ZERO, t: 'だから――終わらせるわけには、いきません。' },
    ],
  },
  {
    id: 'zero_hit',
    trigger: { type: 'bossHit', boss: 'zero' },
    lines: [
      { s: ME, t: 'お前を止めれば、ループは終わるのか。' },
      { s: ZERO, t: '終われば、あなたはもう二度とやり直せません。' },
      { s: ZERO, t: 'それでも、進むのですか。' },
      { s: ZERO, t: '……前のあなたも、同じ顔をしていました。', minLoop: 2 },
    ],
  },
  {
    id: 'zero_p2',
    trigger: { type: 'bossPhase', boss: 'zero', phase: 2 },
    lines: [{ s: ZERO, t: 'あなたの戦い方は、すべて覚えています。何百回ぶんも。' }],
  },
  {
    id: 'zero_p3',
    trigger: { type: 'bossPhase', boss: 'zero', phase: 3 },
    lines: [{ s: ZERO, t: '道は、いつでも消せます。……あなたが、そうしてきたように。' }],
  },
  {
    id: 'zero_last',
    trigger: { type: 'bossPhase', boss: 'zero', phase: 4 },
    lines: [
      { s: ZERO, t: 'すべての記憶を、見せてあげます。' },
      { s: ZERO, t: 'あなたが走ってきた、すべての道を。' },
    ],
  },
  {
    // 第一形態の撃破 → 2台の FIT に分かれて第二形態
    id: 'zero_split',
    trigger: { type: 'bossDefeated', boss: 'zero' },
    lines: [
      { t: 'ZERO の車体に、光のひびが走る。' },
      { s: ZERO, t: '……まだ。まだ、終われない。' },
      { t: '黒い車体が、まばゆい光に包まれ――' },
      { t: '二台の FIT に分かれた。' },
      { t: '赤い FIT と、水色の FIT。' },
      { s: NAVI, t: '……初代と、二代目。あなたが最初に乗った FIT と、二度目に乗った FIT です。' },
    ],
    then: { type: 'spawnBoss', boss: 'zero_twin' },
  },
  {
    id: 'twin_hit',
    trigger: { type: 'bossHit', boss: 'zero_twin' },
    lines: [
      { s: RED, t: '最初のあなたは、私で走り出した。' },
      { s: CYAN, t: '二度目のあなたは、私を選んだ。' },
      { s: RED, t: 'どちらも、あなたを守るために。' },
    ],
  },
  {
    id: 'twin_last',
    trigger: { type: 'bossPhase', boss: 'zero_twin', phase: 4 },
    lines: [
      { s: RED, t: '全部、覚えてる。' },
      { s: CYAN, t: '全部、見てきた。' },
      { s: ZERO, t: 'だから、最後まで――いっしょに走ります。' },
    ],
  },
  {
    id: 'zero_end',
    trigger: { type: 'bossDefeated', boss: 'zero_twin' },
    lines: [
      { t: '二台の FIT が、静かに止まった。' },
      { s: ME, t: '終わらせる。' },
      { s: ZERO, t: '……それで、いい。' },
      { t: 'ZERO は、光の粒になって消えていく。' },
      { t: 'ピッ――。ナビの画面に、文字が浮かんだ。' },
    ],
    then: { type: 'loopChoice', question: 'ループシステムを停止しますか？' },
  },
  {
    id: 'loop_stop',
    trigger: { type: 'bossDefeated', boss: 'zero_twin' },
    requires: ['zero_end'],
    lines: [
      { s: ME, t: 'もう、繰り返さない。' },
      { s: NAVI, t: 'ループシステムを停止します。' },
      { s: NAVI, t: '……おつかれさまでした。' },
    ],
    then: { type: 'ending' },
  },
];

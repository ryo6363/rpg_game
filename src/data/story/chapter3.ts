import type { StoryEventDef } from '../../core/types';

// 第3章「沈んだ世界」のストーリーイベント。
// s = 話者（省略でナレーション）。minLoop / maxLoop で周回ごとに台詞を変えられる。

const ME = '主人公';
const BOSS = 'アビス・ドラグーン';
const ELDER = '長老';
const NAVI = 'ナビ';

export const CHAPTER3_EVENTS: StoryEventDef[] = [
  // ---------------------------------------------------------------- 潮見の港に着く
  {
    id: 'ch3_arrive',
    trigger: { type: 'areaEnter', area: 'port_town' },
    lines: [
      { t: '第3章「沈んだ世界」' },
      { t: '潮の匂い。海沿いの小さな港町は、半分ほどが水に沈んでいる。' },
      { t: '屋根だけを水面に出した家。桟橋の先には、どこまでも続く浅い海。' },
      { s: NAVI, t: '目的地に到着しました。' },
      { s: ME, t: '……また勝手に目的地か。' },
      { s: ME, t: '（灰の都の時計は「4」になった。今度は、何が待ってる？）' },
    ],
  },

  // ---------------------------------------------------------------- 住民の話
  {
    id: 'elder_first',
    trigger: { type: 'talk', npc: 'elder' },
    lines: [
      { s: ELDER, t: 'おお、旅の方か。こんな沈みかけの港へ、よう来なすった。' },
      { s: ELDER, t: 'この海の底にはな、かつて巨大な都があったんじゃ。' },
      { s: ELDER, t: '空まで届く塔、どこまでも続く道……そして、鉄の馬車が走っておったという。' },
      { s: ME, t: '鉄の馬車……車のことか？' },
      { s: ELDER, t: 'さあてな。わしも祖父から聞いた話じゃ。' },
      { s: ELDER, t: '北の桟橋の先に、沈んだ都の外れが顔を出しとる。気になるなら行ってみるといい。' },
      { s: ELDER, t: '……そういえば、祖父はこうも言っとった。「都は、何度も沈み、何度も浮かんだ」とな。' },
    ],
  },
  {
    id: 'elder_again',
    trigger: { type: 'talk', npc: 'elder' },
    requires: ['elder_first', 'ch3_mural'],
    unless: ['elder_again', 'ch3_boss'],
    lines: [
      { s: ME, t: '沈んだ街の壁に、絵が描いてあった。車と……俺によく似た男の絵だ。' },
      { s: ELDER, t: 'ほう……。壁画か。' },
      { s: ELDER, t: '都が沈むたびに、同じ旅人が現れる――そんな言い伝えもあったのう。' },
      { s: ELDER, t: 'ただの昔話じゃ。気にせんでええ。……たぶんな。' },
    ],
  },
  {
    id: 'fisher_first',
    trigger: { type: 'talk', npc: 'fisher' },
    lines: [
      { s: '漁師', t: '潮が満ちると、この広場まで水が来る。足を取られるから気をつけな。' },
      { s: '漁師', t: '水に入ると遅くなるだけで、溺れやしないさ。' },
      { s: '漁師', t: '……ただ、沈んだ街の奥には近づくなよ。「竜」が棲んでるって噂だ。' },
    ],
  },

  // ---------------------------------------------------------------- 沈没都市
  {
    id: 'ch3_field',
    trigger: { type: 'areaEnter', area: 'ch3_field1' },
    lines: [
      { t: '水面の下に、ひび割れた道路が続いている。' },
      { t: '左右には、水没したビルの残骸。水の中に入ると、タイヤが取られて遅くなる。' },
      { s: ME, t: '道の上なら普通に走れるな。……街の、道路だ。' },
      { s: NAVI, t: 'ルートを……ルートを、検索しています……。' },
    ],
  },
  {
    id: 'ch3_center',
    trigger: { type: 'areaEnter', area: 'ch3_field2' },
    lines: [
      { t: '都市の中心部。水晶が、水の中から生えるように光っている。' },
      { s: NAVI, t: '……この道を、知っています。' },
      { s: ME, t: '……ナビ？ 今、なんて言った？' },
      { s: NAVI, t: 'ルートを検索しています。' },
    ],
  },
  {
    id: 'ch3_mural',
    trigger: { type: 'touch', object: 'mural' },
    lines: [
      { t: '崩れかけた広場の奥に、大きな壁画が残っている。' },
      { t: '描かれているのは、一台の車。……FITだ。' },
      { t: 'そして運転席には、ひとりの人物。' },
      { s: ME, t: '……俺？' },
      { s: ME, t: 'いや、違う。似てるだけだ。何百年も前の絵だろ。俺のはずがない。' },
      { s: NAVI, t: '画像を照合しています……一致率、97パーセント。' },
      { s: ME, t: 'やめろ。' },
      { s: NAVI, t: '記録No.???……破損しています。' },
      { s: NAVI, t: '「……ここで……また……」' },
      { s: NAVI, t: '「……次は……もっと……」' },
      { s: NAVI, t: '再生できません。ルートを検索しています。' },
      { s: ME, t: '（今の声……ナビの中に、誰かの記録が残ってる……？）' },
      { s: ME, t: '（この壁画、前の周回でも見た。……それだけは、はっきり分かる）', minLoop: 2 },
    ],
  },

  // ---------------------------------------------------------------- ボス
  {
    id: 'ch3_boss_intro',
    trigger: { type: 'areaEnter', area: 'ch3_boss' },
    unless: ['ch3_boss_intro', 'ch3_boss'],
    lines: [
      { t: '沈没都市の最深部。円い広場を、深い水が囲んでいる。' },
      { t: '水面が盛り上がり――巨大な竜が姿を現した。' },
      { t: '青い鱗。背中には、脈打つように光る水晶。' },
      { s: BOSS, t: '…………。' },
    ],
  },
  {
    id: 'dragoon_hit',
    trigger: { type: 'bossHit', boss: 'abyss_dragoon' },
    lines: [
      { s: BOSS, t: 'その車……その顔……。' },
      { s: BOSS, t: 'また、忘れてきたのか。' },
      { s: ME, t: '忘れた……？ 何をだ！' },
      { s: BOSS, t: '思い出させてやろう。お前が、何度ここで沈んだかを。' },
      { s: BOSS, t: '……今回は、覚えている顔をしているな。', minLoop: 2 },
    ],
  },
  {
    id: 'dragoon_last',
    trigger: { type: 'bossPhase', boss: 'abyss_dragoon', phase: 4 },
    lines: [
      { t: 'ドラグーンが天を仰ぎ、咆哮した。' },
      { s: BOSS, t: '沈め。すべて、はじまりの海へ――輪廻の海！' },
    ],
  },
  {
    id: 'ch3_boss',
    trigger: { type: 'bossDefeated', boss: 'abyss_dragoon' },
    lines: [
      { s: BOSS, t: '何度でも……ここへ戻ってくる……' },
      { t: '竜の体が、水と水晶のかけらになって崩れていく。' },
      { t: '最後に残ったのは、淡く光る結晶がひとつ。' },
    ],
    then: { type: 'spawnObject', object: 'memory_crystal' },
  },
  {
    // ボスを倒したあと、結晶に触れずにエリアを出た場合：戻ってくると結晶がまだある
    id: 'memory_crystal_again',
    trigger: { type: 'areaEnter', area: 'ch3_boss' },
    requires: ['ch3_boss'],
    unless: ['memory_touch'],
    lines: [{ t: '広場の中央で、結晶が静かに光っている。' }],
    then: { type: 'spawnObject', object: 'memory_crystal' },
  },
  {
    id: 'memory_touch',
    trigger: { type: 'touch', object: 'memory_crystal' },
    lines: [
      { t: '記憶の結晶に触れた瞬間――' },
      { t: '頭の奥で、何かが弾けた。' },
    ],
    then: { type: 'flashback' },
  },
  {
    id: 'memory_after',
    trigger: { type: 'touch', object: 'memory_crystal' },
    requires: ['memory_touch'],
    lines: [
      { t: '……沈む前の都市。まっすぐな道。' },
      { t: '走っていたのは、同じ車。運転していたのは、同じ人物。' },
      { s: ME, t: '俺は……この場所に来たことがある？' },
      { s: NAVI, t: '記録No.???の再生を終了しました。' },
      { s: NAVI, t: '……おかえりなさい。' },
      { s: ME, t: '……っ。' },
      { t: '結晶は手の中で小さくなり、ひとつのお守りになった。' },
    ],
    then: { type: 'dropItem', baseId: 'memory_crystal', rarity: 'legendary' },
  },

  // ---------------------------------------------------------------- 第3章ラスト
  {
    id: 'ch3_clear',
    trigger: { type: 'areaEnter', area: 'port_town' },
    requires: ['memory_after'],
    lines: [
      { t: '港へ戻ると、潮が大きく引いていた。' },
      { t: '桟橋の柱に、見覚えのある形の数字が刻まれている。' },
      { t: '「 4 」 → 「 3 」' },
      { s: ME, t: '……また、減った。' },
      { s: ELDER, t: 'あの柱の数字かね？ あれは昔から「3」じゃよ。' },
      { s: ME, t: '（やっぱり、気づいているのは俺だけか）' },
      { s: ME, t: '（俺は、何度この道を走ってきたんだ……？）' },
      { s: NAVI, t: '次の目的地を検索しています……。' },
    ],
    then: { type: 'chapterClear' },
  },
  {
    // クリア後：長老から次の章へ／周回をはじめられる
    id: 'ch3_loop_offer',
    trigger: { type: 'talk', npc: 'elder' },
    requires: ['ch3_clear'],
    unless: [],
    lines: [
      { s: ELDER, t: '都は何度も沈み、何度も浮かぶ。……お前さんも、そうなのかもしれんな。' },
    ],
    then: { type: 'chapterClear' },
  },
];

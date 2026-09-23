// 共通の型定義

export type JobId = 'warrior' | 'mage' | 'hunter';
/** 武装の種類（戦士＝バンパー／魔法使い＝魔導エンジン／狩人＝ボウガン砲台） */
export type WeaponType = 'bumper' | 'engine' | 'turret';

/** 最終ステータス（ジョブ基礎＋Lv成長＋装備で算出） */
export interface Stats {
  maxHp: number;
  atk: number;
  def: number;
  /** 会心率 0〜1 */
  critRate: number;
  /** 会心ダメージ倍率の加算分（0.5 → 基本1.5倍+0.5=2.0倍） */
  critDamage: number;
  /** 移動速度（論理px/秒） */
  moveSpeed: number;
  /** 1秒あたりの通常攻撃回数 */
  attackSpeed: number;
}

export type StatKey = keyof Stats;

/**
 * スキルの種類。種類ごとの処理は systems/SkillRunner.ts
 * - meleeArc: 前方の扇形を攻撃
 * - projectile: 弾を撃つ（複数・拡散・貫通・着弾爆発に対応）
 * - area: 狙った場所を遅れて範囲攻撃（複数回にも対応）
 * - nova: 自分の周囲を範囲攻撃
 * - dash: 向いている方向へ突進し、触れた敵を攻撃
 * - buff: 一定時間ステータスを強化
 */
export type SkillKind = 'meleeArc' | 'projectile' | 'area' | 'nova' | 'dash' | 'buff';

export interface SkillDef {
  id: string;
  name: string;
  /** スキルボタンに出す短い名前（2文字程度） */
  short: string;
  kind: SkillKind;
  /** ダメージ倍率（攻撃力に掛ける） */
  power: number;
  /** クールダウン（秒）。通常攻撃は攻撃速度で決まるので 0 */
  cooldown: number;
  /** エフェクトの色 */
  color?: number;

  /** meleeArc: 射程・扇の角度（度）／ nova・area: 半径 */
  range?: number;
  arc?: number;
  radius?: number;
  /** エフェクトのスプライトキー */
  effect?: string;

  /** projectile: 弾の設定 */
  projectile?: {
    sprite: string;
    speed: number;
    /** 飛ぶ距離 */
    distance: number;
    count?: number;
    /** 複数発の広がり（度） */
    spread?: number;
    /** 貫通できる敵の数 */
    pierce?: number;
    /** 着弾時の爆発半径 */
    explodeRadius?: number;
    /** 当たり判定の半径 */
    hitRadius?: number;
  };

  /** area: 着弾までの時間・回数・散らばり */
  delay?: number;
  strikes?: number;
  scatter?: number;

  /** dash: 速度と時間 */
  dashSpeed?: number;
  dashTime?: number;

  /** buff: 倍率と時間 */
  buff?: { stats: Partial<Record<StatKey, number>>; duration: number };
}

export interface JobDef {
  id: JobId;
  name: string;
  /** ジョブ選択画面の説明 */
  description: string;
  weaponType: WeaponType;
  /** 最初から装備している武装（data/itemBases.ts の id） */
  starterWeapon: string;
  sprite: string;
  base: Stats;
  /** Lv1 から 1 上がるごとの増加量 */
  growth: Partial<Stats>;
  basicAttack: string;
  skills: { id: string; unlockLevel: number }[];
}

/** 敵AIの種類。melee = 近づいて攻撃（移動速度0なら固定砲台）/ boss = 攻撃パターンから選ぶ */
export type EnemyAiKind = 'melee' | 'boss';

/**
 * 予兆範囲（AoE）の形。向きは攻撃開始時の敵→プレイヤー方向
 * - circle: 中心から半径 radius（offset だけ前方にずらせる）
 * - cone: 扇形。angle は全体の開き（度）
 * - line: 前方へ長さ length・幅 width の帯
 * - ring: ドーナツ型。inner より内側（中心付近）は安全
 * - cross: 中心から縦横に長さ length・幅 width の十字。斜めが安全
 */
export type AoeShape =
  | { type: 'circle'; radius: number; offset?: number }
  | { type: 'cone'; radius: number; angle: number }
  | { type: 'line'; length: number; width: number }
  | { type: 'ring'; inner: number; outer: number }
  | { type: 'cross'; length: number; width: number };

/** 敵の攻撃 */
export interface EnemyAttackDef {
  shape: AoeShape;
  /** 予兆が出てから判定までの秒数 */
  windup: number;
  /** 攻撃力に掛ける倍率（省略時 1） */
  power?: number;
  /** 判定の瞬間に向きの方向へ飛び出す速さ（体当たり） */
  lunge?: number;
  /** 飛び出している時間（秒。省略時 0.12） */
  lungeTime?: number;
  /** 範囲の基点。self = 自分の位置（既定）/ target = 攻撃開始時のプレイヤーの位置 */
  at?: 'self' | 'target';
  /** 判定の瞬間の演出 */
  effect?: AoeEffect;
  /** 攻撃後の硬直（省略時は敵の recover） */
  recover?: number;

  /** 同じ攻撃を続けて何回出すか（毎回狙い直す） */
  repeat?: number;
  /** 連続攻撃の1回ごとの溜め時間（省略した回は windup） */
  repeatWindups?: number[];
  /**
   * 円の予兆を count 個、interval 秒ずつずらして出す。
   * around: player = プレイヤーの周り（1個目は足元）/ arena = ボスエリア全体（中心は出現位置）
   */
  scatter?: { count: number; radius: number; interval: number; around?: 'player' | 'arena' };
  /** 飛び出し中にプレイヤーに触れたときのダメージ倍率（突進そのものの当たり判定） */
  contact?: number;
  /** 飛び出した軌跡に残る炎の床（触れている間ダメージが続く） */
  trail?: { duration: number; radius: number; power: number; tick: number };
  /** 特殊な攻撃（処理は systems/EnemyAI.ts） */
  special?: 'arenaCollapse' | 'timeStop' | 'finale';
  /** arenaCollapse: 残す安全地帯の数 / エリアの広さ */
  safeSpots?: number;
  arenaRadius?: number;
}

/**
 * 予兆範囲の判定時の演出
 * flame = 範囲いっぱいに炎 / meteor = 上空から落ちてくる / finale = 必殺技の大爆発（画面揺れ・効果音）
 */
export type AoeEffect = 'flame' | 'meteor' | 'finale';

/** ボスの攻撃パターン */
export interface BossPatternDef extends EnemyAttackDef {
  id: string;
  name: string;
  /** 選ばれやすさ */
  weight: number;
  /** プレイヤーがこの距離以内のときだけ使う */
  range: number;
  /** このフェーズ以上で使う（1 始まり） */
  minPhase?: number;
  /** 判定の瞬間に範囲の中心へ跳ぶ */
  leap?: boolean;
  /** 跳ぶ時間（秒。省略時 0.2） */
  leapTime?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  ai: EnemyAiKind;
  hp: number;
  atk: number;
  def: number;
  moveSpeed: number;
  /** 気づく距離 */
  aggroRange: number;
  /** 攻撃を始める距離 */
  attackRange: number;
  attack: EnemyAttackDef;
  /** 攻撃後の硬直時間（秒） */
  recover: number;
  /** 当たり判定の半径 */
  bodyRadius: number;
  exp: number;
  /** ドロップ率の倍率（省略時 1） */
  dropRate?: number;
  /** ノックバックしない（重い敵・固定砲台） */
  heavy?: boolean;

  /** ---- ボスのみ */
  boss?: {
    /** 攻撃パターン */
    patterns: BossPatternDef[];
    /** フェーズが上がる HP の割合（例 [0.5] → 50% 以下でフェーズ2） */
    phases: number[];
    /** 攻撃と攻撃の間の最短時間 */
    interval: number;
    /** フェーズごとの攻撃間隔の倍率（[フェーズ1, 2, …]。小さいほど攻撃が速い） */
    intervalByPhase?: number[];
    /** そのフェーズに入ったら必ず次に使う技（フェーズ番号 → 技の id） */
    forcedOnPhase?: Record<number, string>;
    /** 確定ドロップ */
    loot: { count: number; minRarity: Rarity };
  };
}

/** 町の NPC */
export interface NpcDef {
  id: string;
  name: string;
  sprite: string;
  /** マップ上の位置を表す文字（data/maps.ts） */
  marker: string;
  /** 話しかけたときの動作（会話のあとに開くメニュー） */
  action: 'jobChange' | 'upgrade' | 'talk';
  /** ストーリーイベントがないときの会話 */
  lines: DialogLine[];
}

/** フィールドに置く調べられる物（近づくと自動でイベント） */
export interface AreaObjectDef {
  id: string;
  sprite: string;
  marker: string;
  /** この周回数の範囲でだけ置く */
  minLoop?: number;
  maxLoop?: number;
  /** ぶつかる（通り抜けられない） */
  solid?: boolean;
  /** このフラグが立っていたら絵のコマを変える */
  frameWhen?: { flag: string; frame: number };
}

/** エリア間の出入口 */
export interface ExitDef {
  /** マップ上の文字（門のタイルとして描画される） */
  char: string;
  to: string;
  /** 移動先マップで出現する位置の文字（省略時は '@'） */
  arrive?: string;
  /** このフラグが立つまで通れない */
  requires?: string;
  /** 通れないときのメッセージ */
  lockedText?: string;
}

/** エリア定義（町・フィールド・ボスエリア） */
export interface AreaDef {
  id: string;
  name: string;
  /** どの章のエリアか（入ると章の進行が進む） */
  chapter: number;
  type: 'town' | 'field';
  /** マップ外周の余白に使うタイルの文字（省略時は木 'T'） */
  border?: string;
  map: string;
  /** 目印の文字の下に敷く床タイルの文字 */
  floor: string;
  level: number;
  maxEnemies: number;
  enemies: { id: string; weight: number }[];
  exits: ExitDef[];
  npcs?: NpcDef[];
  objects?: AreaObjectDef[];
  /** ボスエリアならボスの敵 id と出現位置の文字 */
  boss?: { id: string; marker: string };
}

// ---------------------------------------------------------------- ストーリー

/** 会話の1行。s = 話者（省略でナレーション） */
export interface DialogLine {
  s?: string;
  t: string;
  /** この周回数の範囲でだけ表示 */
  minLoop?: number;
  maxLoop?: number;
}

/** イベントのきっかけ */
export type StoryTrigger =
  | { type: 'areaEnter'; area: string }
  | { type: 'talk'; npc: string }
  | { type: 'touch'; object: string }
  | { type: 'bossHit'; boss: string }
  | { type: 'bossPhase'; boss: string; phase: number }
  | { type: 'bossDefeated'; boss: string };

/** ストーリーイベント。条件を満たすきっかけが起きたら会話を再生し、フラグを立てる */
export interface StoryEventDef {
  id: string;
  trigger: StoryTrigger;
  /** すべて立っていること */
  requires?: string[];
  /** どれも立っていないこと（省略時は自分の id。つまり1周に1回） */
  unless?: string[];
  minLoop?: number;
  maxLoop?: number;
  lines: DialogLine[];
  /** 会話のあとに立てるフラグ（自分の id は自動で立つ） */
  setFlags?: string[];
  /** 会話のあとの動作 */
  then?:
    | { type: 'chapterClear' }
    | { type: 'goTo'; area: string; arrive?: string }
    | { type: 'dropItem'; baseId: string; rarity: Rarity }
    | { type: 'npcMenu' };
}

/** 章 */
export interface ChapterDef {
  id: number;
  title: string;
  subtitle: string;
  /** 次の章（なければ最終章。クリアで周回へ） */
  next?: number;
  /** false ならまだ遊べない（準備中） */
  available: boolean;
  /** 章の最初に入るエリア */
  startArea: string;
}

// ---------------------------------------------------------------- 装備

export type Rarity = 'normal' | 'magic' | 'rare' | 'legendary';
/** 部位。表示名は data/slots.ts（武装／ヘルメット／装甲／ハンドル／タイヤ／お守り） */
export type Slot = 'weapon' | 'head' | 'body' | 'hands' | 'feet' | 'accessory';
export type ArmorSlot = Exclude<Slot, 'weapon'>;

/** 装備のベース（種類）。data/itemBases.ts */
export interface ItemBaseDef {
  id: string;
  name: string;
  slot: Slot;
  /** 武装のみ：装備できるジョブの武装種 */
  weaponType?: WeaponType;
  icon: string;
  /** Lv1 時点の基本性能。アイテムレベルで伸びる */
  stats: Partial<Stats>;
  /** このアイテムレベル以上でドロップする */
  minLevel: number;
  /** true ならランダムドロップに出ない（イベント専用） */
  unique?: boolean;
}

/** 追加効果の定義。data/affixes.ts */
export interface AffixDef {
  id: string;
  stat: StatKey;
  /** flat: 足し算 / percent: 掛け算（+x%） */
  mode: 'flat' | 'percent';
  /** アイテムレベル1での値の範囲と、1レベルごとの上昇 */
  min: number;
  max: number;
  perLevel: number;
  slots: Slot[];
  weight: number;
  /** マジック品の名前に付く接頭語 */
  prefix: string;
  /** 指定すると「このスキルの威力 +x%」になる（stat は無視） */
  skill?: string;
}

/** 実際に手に入る装備 */
export interface ItemInstance {
  uid: string;
  baseId: string;
  rarity: Rarity;
  itemLevel: number;
  name: string;
  /** 基本性能（生成時に確定） */
  stats: Partial<Stats>;
  affixes: { id: string; value: number }[];
  /** 強化値（町の整備士で上げる） */
  upgrade: number;
}

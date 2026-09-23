// HUD に表示する状態。プレイヤー／町のシーンが毎フレーム書き込み、UIScene が読む

export interface SkillHud {
  short: string;
  unlocked: boolean;
  unlockLevel: number;
  /** 残りクールダウンの割合 0〜1 */
  cooldown: number;
}

export const HudState = {
  skills: [] as SkillHud[],
  /** 攻撃ボタンの代わりに出す文字（町で NPC の近くにいるとき「話す」など） */
  interactLabel: null as string | null,
  /** 攻撃ボタンが使えるか（町では NPC の近く以外は使えない） */
  attackEnabled: true,
  /** スキルボタンが使えるか（町では使えない） */
  skillsEnabled: true,
  /** 戦闘中のボス（HP バーを出す） */
  /** attack = いま使っている技の名前（溜め・突進・特殊技の間だけ） */
  boss: null as { name: string; hp: number; maxHp: number; attack: string | null } | null,
};

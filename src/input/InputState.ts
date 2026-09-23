// タッチとキーボードの入力を1か所にまとめる。
// UIScene が書き込み、FieldScene（プレイヤー）が読む。

export const InputState = {
  /** 移動入力 -1〜1（アナログ） */
  moveX: 0,
  moveY: 0,
  attackHeld: false,
  /** 押されたスキル番号（0始まり）。読んだ側が消費する */
  skillQueue: [] as number[],

  consumeSkill(): number | undefined {
    return this.skillQueue.shift();
  },

  reset() {
    this.moveX = 0;
    this.moveY = 0;
    this.attackHeld = false;
    this.skillQueue.length = 0;
  },
};

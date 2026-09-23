# ドットクエスト

スマホ縦持ち向けのドット絵ハクスラ ARPG（Vite + TypeScript + Phaser 3）。

## 開発

```bash
npm install
npm run dev
```

- PC: http://localhost:5173/rpg_game/
- スマホ（同じ Wi-Fi）: `npm run dev` の出力にある `Network: http://192.168.x.x:5173/rpg_game/` を Safari で開く
  - 初回に Windows ファイアウォールの許可ダイアログが出たら「プライベート ネットワーク」を許可する

### 操作

| | タッチ | キーボード |
|---|---|---|
| 移動 | 画面左下を触ってドラッグ（仮想スティック） | WASD / 矢印キー |
| 通常攻撃 | 右下「攻撃」を押しっぱなし（最寄りの敵へ自動で向く） | J / Space |
| スキル | 右下 1〜3 | 1 / 2 / 3 |
| インベントリ | （ステップ2で追加） | I |

## ビルド

```bash
npm run build     # 型チェック + dist/ へ出力
npm run preview   # ビルド結果の確認
```

## GitHub Pages へのデプロイ

`vite.config.ts` の `base` は `/rpg_game/`（リポジトリ名）に設定済み。リポジトリ名を変える場合はここも合わせる。

1. GitHub のリポジトリで **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
2. `main` ブランチに push すると `.github/workflows/deploy.yml` が自動でビルド・公開する
3. 公開 URL: `https://<ユーザー名>.github.io/rpg_game/`

iPhone では Safari の共有メニューから「ホーム画面に追加」すると、アドレスバーなしの全画面で遊べる。

## ディレクトリ構成

```
src/
├─ config/balance.ts   調整用の数値（ダメージ式・速度・出現数など）
├─ data/               データ定義（ロジックを触らずに追加できる）
│  ├─ sprites.ts       ドット絵（パレット＋ピクセル文字列）※画像差し替えはここ
│  ├─ tiles.ts / maps.ts / areas.ts
│  ├─ jobs.ts / skills.ts / enemies.ts
├─ core/               状態・画面サイズ・テクスチャ生成・イベント
├─ systems/            ダメージ計算・スキル実行・敵AI・ステータス計算
├─ entities/           Player / Enemy / ダメージ数字
├─ input/              仮想スティック・ボタン・入力状態
├─ ui/                 UI 部品
└─ scenes/             Boot / Title / Field / UI
```

### 拡張のしかた

- **敵を増やす**: `data/sprites.ts` に見た目、`data/enemies.ts` に定義を追加し、`data/areas.ts` の `enemies` に登録
- **新しい敵の動き**: `systems/EnemyAI.ts` に関数を追加して `ENEMY_AI` に登録
- **スキルを増やす**: `data/skills.ts` に定義。新しい種類（弾・範囲など）は `systems/SkillRunner.ts` に処理を追加
- **マップ**: `data/maps.ts` に文字列で描く（文字の意味は `data/tiles.ts`）

# FIT QUEST（フィットクエスト）

「終わりは、いつも始まりだった。」
古いコンパクトカー「FIT」で世界を走る、スマホ縦持ち向けの周回型ドット絵ハクスラ ARPG（Vite + TypeScript + Phaser 3）。

## 開発

```bash
npm install
npm run dev
```

- PC: http://localhost:5173/rpg_game/
- スマホ（同じ Wi-Fi）: `npm run dev` の出力にある `Network: http://192.168.x.x:5173/rpg_game/` を Safari で開く
  - 初回に Windows ファイアウォールの許可ダイアログが出たら「プライベート ネットワーク」を許可する

### iPhone で遊ぶとき（おすすめ）

**`スマホで遊ぶ.bat` をダブルクリック**するだけ（最新版をビルドして、スマホ用のサーバーを起動する）。

- 黒いウィンドウに、iPhone の Safari で開くアドレスが表示される（例: `http://192.168.0.23:4173/rpg_game/`）
- **ウィンドウを閉じるとスマホから開けなくなる**。遊んでいる間は開いたままにする
- サーバーが落ちても自動で起動し直す。PC の IP アドレスが変わったら、新しいアドレスを表示し直す
- IP アドレスが変わっても使えるアドレス `http://PCの名前.local:4173/rpg_game/` も表示される（iPhone で開ければ、ブックマークしておくと便利）
- PC がスリープすると開けなくなる。遊ぶ間はスリープしない設定にしておく
- コマンドで起動する場合は `npm run phone`（中身は同じ）
- 4173 番がすでに使われているとエラーで止まる（別の番号に変わってアドレスがずれるのを防ぐため）。先に起動したウィンドウを閉じてからやり直す

### 操作

| | タッチ | キーボード |
|---|---|---|
| 移動 | 画面左下を触ってドラッグ（仮想スティック） | WASD / 矢印キー |
| 通常攻撃 | 右下「攻撃」を押しっぱなし（最寄りの敵へ自動で向く） | J / Space |
| スキル | 右下の青いボタン（Lv1 / 3 / 6 で解放。暗い扇形はクールダウン） | 1 / 2 / 3 |
| 話す（町） | NPC に近づくと攻撃ボタンが「話す」になる | J / Space |
| 持ち物・装備 | 右上のカバンボタン | I（閉じるのは I / Esc） |

### 隠しデバッグメニュー

タイトル画面の「FIT QUEST」のロゴを **3秒以内に5回タップ**（PC ではキーボードで `D` `E` `B` `U` `G`）すると開く。

- 各エリア・ボスステージへ直接移動（倒したボスも再出現する）
- 無敵の ON/OFF（ページを読み直すと OFF に戻る）、今のジョブの Lv+5、ゴールド+1000

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
│  ├─ chapters.ts      章の一覧（準備中の章も含む）
│  ├─ story/           章ごとのストーリーイベントと台詞
├─ core/               状態・画面サイズ・テクスチャ生成・イベント
├─ systems/            ダメージ計算・スキル実行・敵AI・ステータス計算
├─ entities/           Player / Enemy / ダメージ数字
├─ input/              仮想スティック・ボタン・入力状態
├─ ui/                 UI 部品
└─ scenes/             Boot / Title / Town・Field（共通の土台 WorldScene）/ UI / Inventory / JobSelect
```

### 拡張のしかた

- **敵を増やす**: `data/sprites.ts` に見た目、`data/enemies.ts` に定義を追加し、`data/areas.ts` の `enemies` に登録
- **敵の攻撃範囲（予兆）**: `data/enemies.ts` の `attack` に形（円 circle／扇 cone／直線 line／ドーナツ ring／十字 cross／長方形 rect）と溜め時間を書く。連続攻撃（repeat）・ばらまき（scatter）・突進の接触判定（contact）・炎の床（trail）・弾（projectile）・水たまりを残す（leaveWater）・引き寄せ（pull）・特殊技（special：王都崩壊／時葬／輪廻断絶／潜航／津波・尻尾の薙ぎ払い／渦の弾幕／幻影／輪廻の海／時計盤の針／時間逆行／過去再演／輪廻の鎖／終焉時計／時間停止）も指定できる。敵そのものには透明化（blink）・防御姿勢（guard）・戦闘中の台詞（barks）・確定ドロップ（guaranteedLoot）・低確率の特別ドロップ（rareDrop）・数回に1回の別攻撃（altAttack）・群れ（pack）・色味（tint）・飛行（hover）を付けられる。過去再演は、指定したボスの技（data/enemies.ts の patterns）をそのまま幻影に使わせる見た目の色は `config/balance.ts` の TELEGRAPH
- **新しい敵の動き**: `systems/EnemyAI.ts` に関数を追加して `ENEMY_AI` に登録
- **ステータスポイント**: Lv1 で1ポイント、レベルが1上がるごとに1ポイント（ジョブごと）。画面右上の持ち物ボタンの左にあるステータスボタン（PC は C キー）から攻撃力・防御力・速度・HPアップ・会心率に振る。1ポイントあたりの上昇量は `config/balance.ts` の STAT_POINT_VALUES、もらえる数は STAT_POINTS。最終ステータスの計算は `systems/StatCalculator.ts` に集約（ポイントの補正は allocationModifiers。一定数振ったときの追加効果などはここに足す）
- **装備の種類を増やす**: `data/itemBases.ts` に追加（アイコンは `data/sprites.ts` の ICON_SPRITES）
- **追加効果を増やす**: `data/affixes.ts` に追加。ドロップ率・レアリティ確率などは `config/balance.ts` の LOOT
- **スキルを増やす**: `data/skills.ts` に定義。新しい種類（弾・範囲など）は `systems/SkillRunner.ts` に処理を追加
- **スキルを装備で強化**: 各ジョブのスキルに「威力 +x%」の追加効果が自動で作られる（`data/affixes.ts`）
- **マップ**: `data/maps.ts` に文字列で描く（文字の意味は `data/tiles.ts`）。タイル以外の文字は目印（出現位置・NPC の位置）
- **ストーリー**: `data/story/chapterN.ts` にイベント（きっかけ・条件・台詞・その後の動作）を書き、`data/story/index.ts` に並べる。台詞は `minLoop` / `maxLoop` で周回ごとに変えられる
- **章を増やす**: `data/chapters.ts` の `available` を true にし、エリア・ストーリーを追加する。最終章（`next` なし）をクリアすると周回に入る
- **最終章・最終ボス**: ZERO（第一形態）と赤・水色の FIT（第二形態）の技は `systems/ZeroAI.ts`。技の数値は `data/enemies.ts` の `opts`。ボスの `finisher`（HP 0 で必ず使う技・耐えきると撃破）、`partner`（相棒。ダメージは本体へ）、`opening`（最初の技）、エリアの `boss.then`（第二形態）、ストーリーの `spawnBoss` / `loopChoice` / `ending` で組み立てている
- **最終章のフィールドのしかけ**: エリアの `gimmicks`（消える道路・過去の景色・過去のボスの技・浮かぶ景色のかけら）と `riftExits`（時間の裂け目）。処理は `systems/FieldGimmicks.ts` と `entities/PitManager.ts`
- **周回（2周目以降）**: `config/balance.ts` の LOOP（敵レベル・HP/攻撃力の上乗せ・レア率・敵の数・ボスの攻撃間隔）。`minLoop` を付けると、その周回から出る装備（itemBases）・追加効果（affixes）・ボスの技（patterns）・物（objects）・台詞やイベントになる
- **ボス**: `data/enemies.ts` で `ai: 'boss'` にし、`boss.patterns`（攻撃パターン）と `phases`（フェーズが変わる HP の割合）を書く。`data/areas.ts` の `boss` で出現位置を指定
- **調べる物**: `data/areas.ts` の `objects` に置き、ストーリーの `touch` イベントで台詞を付ける。`loot` を付けると宝箱（1周に1回）、`hidden` はイベント（spawnObject）で出す物、`hideWhen` はフラグで消える物
- **水**: 浅瀬タイル（`%`）と水たまりは入ると遅くなる（ダメージなし）。遅くなる割合と潮の満ち引きの周期は `config/balance.ts` の WATER、潮だまりの位置はエリアの `tideMarker` の文字
- **演出つきのイベント**: ストーリーの `then` で、過去の映像（flashback）・時計が砕けて時間が止まる（clockBreak）・世界の崩壊（collapse）・章タイトルの暗転（titleCard）を使える。エリアの `frozenWhen` のフラグが立つと、そのエリアは時間が止まった状態（モノクロ）になる
- **エリア・出入口**: `data/areas.ts` の `exits` に「踏む文字・行き先・出現位置の文字」を書く
- **町の NPC**: `data/areas.ts` の `npcs` に追加（見た目は `data/sprites.ts` の personSprite）

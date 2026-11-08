# 引き継ぎ：AZ-900 試験対策アプリを「ビジキャリ 問題集」と同じ方式で作る

このファイルは、新しいチャットで作業を始めるための引き継ぎ資料です。
新しいチャットの最初に、このファイルを渡してください（末尾に貼り付け用の指示文があります）。

---

## 1. やりたいこと

Microsoft の資格試験 **AZ-900（Azure Fundamentals）** の対策アプリを、既存の「ビジキャリ 問題集」と同じ方式で作る。

- スマホで開く、問題を解く、成績と苦手テーマが残る、という使い方は同じ。
- 問題は AI（Gemini）で作り、**あらかじめ作って検算した問題バンク（JSON）から即時出題**する。ユーザーを待たせず、API キーも要らない形にする。
- ユーザーは日本語話者（Asia/Tokyo）。やり取りは日本語・簡潔に。

## 2. 手本になる既存アプリ

| 項目 | 内容 |
|---|---|
| 公開URL | https://takuro-o.github.io/business-career/ |
| リポジトリ | `Takuro-O/business-career`（main に直接 push。GitHub Pages で公開） |
| 構成 | 単一の `index.html`（約2,200行、素の HTML/CSS/JS、外部依存なし）＋ `manifest.webmanifest` ＋ `icons/` |
| 問題バンク | `bank/<分野ID>-<等級>.json`（`{field, grade, updatedAt, questions:[{q, choices[4], answer(0-3), explanation, topic, volatile, createdAt}]}`） |
| 生成スクリプト | `tools/generate-bank.mjs`（Node。jsdom でアプリ本体を動かし、アプリの生成処理をそのまま使う） |
| 自動生成 | `.github/workflows/bank.yml`（GitHub Actions。1日3回。秘密情報 `GEMINI_API_KEY`） |
| テスト | `tests/run1.js` 〜 `run11.js`、`run8.mjs`、`run10.mjs`（jsdom。`npm i jsdom` して `node tests/run2.js` のように実行） |

## 3. 仕組みの要点（アプリ内の処理の流れ）

### 出題（ユーザーが「開始」を押したとき）
1. `bank/<分野>-<等級>.json` があり10問以上なら、そこから出題（`getBank` → `pickFromBank`）。APIキー不要。
   - 直近20回分の問題と似たものは避ける（文字2-gram の Jaccard ≥ 0.55 を「似ている」とみなす）。
   - テーマの割り振り（`planTopics`）に沿って選ぶ。「苦手中心」は苦手テーマを約70%にする。
2. 元資料を貼ったとき、「AIでその場で作る」をオンにしたとき、バンクが無いときは、その場でAI生成。

### AI生成（`buildQuiz`）
`planTopics`（各問のテーマを先に割り振る）→ `generateQuestions`（Gemini。基準日・資料・良問の条件・テーマ語彙・表記ルールをプロンプトに入れる）→ `normalizeQuestion`（検証・選択肢のシャッフル・テーマ表記の統一）→ `removeDuplicates` → `verifyQuestions`（**検算**：正解を隠した状態で別呼び出しで解かせ、答えが合わない・曖昧・自信が低いものを捨てる）→ 足りなければ1回だけ追加生成。

### バンク生成（`tools/generate-bank.mjs`）
- jsdom でアプリを読み込み、`startQuiz` を押す動作をそのまま再現して、できた問題を `bank/*.json` に追記する。
- `node tools/generate-bank.mjs auto 50 3`：問題数が少ない「分野×等級」から順に、各50問を目標に追加。無料枠（429・1日上限）で中断し、翌日の実行で続きを作る。
- 失敗（503・1分あたりの429）は60秒待って最大5回やり直す。

### 保存（localStorage、すべて端末内）
`bizcareer_quiz_v1`（成績・履歴）、`bizcareer_quiz_progress_v1`（解答途中）、`bizcareer_gemini_key`、`bizcareer_source_v1`（元資料）、`bizcareer_verify`、`bizcareer_live`、`bizcareer_usage_v1`（無料枠の目安カウンタ）。

## 4. AZ-900 に作り替えるときの判断と変更点

### 先に決めること（ユーザーに聞く）
1. **リポジトリ**：新しいリポジトリ（例 `az900`）に分けるのがおすすめ。既存アプリの `index.html` と `tools/`・`tests/`・`.github/` をコピーして作る。
   ユーザーが GitHub で空のリポジトリを作り、Pages を有効にする必要がある（Settings → Pages → main / root）。
2. **問題の形式**：既存アプリは「4択・正解1つ」のみ。AZ-900 本番には、複数選択・Yes/No・並べ替えなどもある。まず4択だけで始めてよいか確認する。
3. **問題の言語**：日本語の問題文に、Azure のサービス名・用語は英語（日本語併記）にする案が無難。本番を日本語で受けるのか英語で受けるのかも聞く。
4. **問題数の目標**：分野（ドメイン）ごとに何問ためるか。既存は1組み合わせ50〜100問。

### 必ず直すところ（既存アプリのまま使うと壊れる／おかしくなる）
- **localStorage のキー名を変える（重要）。** GitHub Pages は `takuro-o.github.io` が同じオリジン（ドメイン）なので、リポジトリが違っても localStorage は共有される。キーが同じだと、ビジキャリの成績と混ざる・上書きされる。接頭辞を `az900_` などに変える。
  - Gemini の API キーだけは、共有しても便利なので、同じキー名のままにする手もある（ユーザーに確認）。
- **Service Worker の掃除コード**（`index.html` 末尾）は、`bizcareer-` で始まるキャッシュを消す処理。新アプリでは不要なので消す。
- `manifest.webmanifest`・`<title>`・OGP・アイコン・テーマ色・アプリ名を AZ-900 用に変える（アイコンは自作でよい。Microsoft のロゴは使わない）。
- **「等級」の概念をなくす。** AZ-900 は級がない。等級セレクタを消すか、ドメイン（下記3つ）を選ぶ形にする。バンクのファイル名は `bank/<ドメインID>.json` などにする。
- `FIELDS`（分野の定義）を、AZ-900 のドメイン3つに置き換える。ランダム出題（`id: 'random'` の仮想分野）はそのまま使える。
- プロンプトの文言（「ビジネス・キャリア検定」「3級は基本的な知識…」など）を、AZ-900 向けに書き換える。

### AZ-900 の試験範囲（Microsoft 公式。学習ガイド更新日 2026-06-22 時点）
出典：Microsoft Learn の AZ-900 Study guide。**作る直前に、最新版を確認し直すこと。**

1. **クラウドの概念**（25〜30%）
   - クラウドコンピューティング（共有責任モデル、パブリック／プライベート／ハイブリッド、従量課金モデル、料金モデルの比較、サーバーレス）
   - クラウドサービスの利点（高可用性・スケーラビリティ、信頼性・予測可能性、セキュリティ・ガバナンス、管理容易性）
   - クラウドサービスの種類（IaaS・PaaS・SaaS と使い分け）
2. **Azure のアーキテクチャとサービス**（35〜40%）
   - コアなアーキテクチャ要素（リージョン、リージョンペア、ソブリンリージョン、可用性ゾーン、データセンター、リソースとリソースグループ、サブスクリプション、管理グループ）
   - コンピューティングとネットワーク（コンテナー・VM・Functions、VM のオプション、アプリのホスティング、仮想ネットワーク・ピアリング・DNS・VPN Gateway・ExpressRoute、パブリック／プライベートエンドポイント）
   - ストレージ（サービスの比較、アクセス層、冗長性、AzCopy・Storage Explorer・File Sync、Azure Migrate・Data Box）
   - ID・アクセス・セキュリティ（Microsoft Entra ID・Entra Domain Services、認証方法、外部ID、条件付きアクセス、RBAC、ゼロトラスト、多層防御、Microsoft Defender for Cloud）
3. **Azure の管理とガバナンス**（30〜35%）
   - コスト管理（コストの要因、料金計算ツール、Cost Management、タグ）
   - ガバナンスとコンプライアンス（Microsoft Purview、Azure Policy、リソースロック）
   - リソースの管理とデプロイ（ポータル、Cloud Shell・CLI・PowerShell、Azure Arc、IaC、ARM・ARM テンプレート）
   - 監視（Azure Advisor、Service Health、Azure Monitor・Log Analytics・アラート・Application Insights）

テーマ語彙（`topics`）は、上の小項目から作る（既存アプリの各分野の `topics` と同じ形式で、1分野あたり10〜15語）。表記ゆれの吸収（`TOPIC_ALIASES`）も必要に応じて足す。

### AZ-900 特有の注意
- **情報が古くなりやすい。** Azure はサービス名の変更が多い（例：Azure Active Directory → Microsoft Entra ID）。`volatile`（要確認）の印を積極的に使い、バンクの作成日を見て、定期的に作り直す。プロンプトには「現行の名称を使う」「旧名称は選択肢のひっかけとしても使わない」を入れる。
- **料金・SLA の具体的な数字は問題にしない**（変わりやすい）。概念（従量課金、SLA の考え方、可用性ゾーンの役割など）に絞る。
- **本番の問題や、いわゆる「ダンプ」を再現・転載しない。** 試験の実際の問題を覚えて作ることはしない。公式の学習パス（Microsoft Learn）の範囲から、独自に作る。
- 元資料機能（資料を貼ってそこから出題）は、Microsoft Learn の本文を貼って使える。著作権の観点で、本文をバンクにそのまま転載しないこと。

## 5. 作業中にわかったこと（ハマりどころ）

- **モデルの速さがぜんぜん違った。** 実測では、`gemini-3.8-flash` は約3,000トークンの出力に72〜300秒かかり、タイムアウトも出た。`gemini-3.6-flash` は同じ量で約19秒、検算は約2秒。アプリは `MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash']` の順で、404 のときだけ次へ回す。モデル名は変わるので、始める前に最新の Flash 系を確認し、**ワークフローの入力 `models` で1回試して時間を測る**こと。
- **思考（thinking）は `thinkingConfig: { thinkingLevel: 'low' }` で最小にしている。** 受け付けないモデルで 400（thinking の文言入り）が返ったら、設定なしで1回だけやり直す。
- 無料枠は**1日あたり**と**1分あたり**の両方がある。1日の上限の 429（`PerDay` を含む）はその日は止め、1分あたりは待てば戻る。アプリ内の `DAILY_LIMIT = 20` は**仮の値**なので、AI Studio の rate limit ページ（https://aistudio.google.com/rate-limit）で実際の値を確認して合わせる。
- 503（混雑）は時々出る。バンク生成は待って再試行するので問題ないが、アプリのライブ生成は1回で失敗扱いにしている。
- **自動テストは、モックの API で作ったもの。** 本物の Gemini での動作は、実行ログ（`gh run view <id> --log`）で確認してきた。ログには API 呼び出しごとの所要時間と出力トークン数が出る。
- 生成した問題は、数問ずつ必ず人が読んで確認する（法令・数字・名称の誤りが混じり得る）。今回も、バンクの中身は先頭数問しか読んでいない。

## 6. 開発環境（Claude のクラウド環境）の制約

- シェルからの外部アクセスは許可リスト制。`curl` で公開サイトを見られない（WebFetch は使える）。
- `gh` は使えるが、GraphQL は不可。REST で行う。ワークフローの手動実行は
  `gh api -X POST repos/<owner>/<repo>/actions/workflows/bank.yml/dispatches -f ref=main`（入力付きは `-f 'inputs[models]=...' -f 'inputs[target]=40'`）。
- **GitHub の秘密情報（`GEMINI_API_KEY`）の登録は、ユーザーがブラウザでやる**必要がある（スマホの GitHub アプリには設定画面がない）。URL：`https://github.com/<owner>/<repo>/settings/secrets/actions`
- ワークフローのファイル（`.github/workflows/`）の push はできた。
- 動作確認は jsdom のテスト（`tests/`）と、Playwright（クラウド環境に入っている）。

## 7. ユーザーとの進め方（これまでの流れ）

- ユーザーが依頼 → Claude が提案 → ユーザーが承認 → 実装・テスト・push → 簡潔に日本語で報告、の繰り返し。
- 「正直に答えて」と言われることが多い。できていないこと・未確認のことは、そのまま伝える（例：本物のAPIは未確認）。
- 「シンプルにしたい」が強い。使われない機能や作り込みすぎは、提案して削る方向。
- 質問には、まず結論から答える。選択肢を出すときは、おすすめを先に言う。
- コミットメッセージは日本語。main に直接 push してよい（ユーザーが承認済み）。

## 8. 新しいチャットで最初にやること（手順案）

1. このファイルを読み、「先に決めること」4点をユーザーに確認する（最初は1つずつ短く聞く）。
2. 新リポジトリが用意できたら、`add_repo` で追加し、`business-career` の `index.html`・`tools/`・`tests/`・`.github/`・`icons/`・`manifest.webmanifest` をコピーする。
3. 「必ず直すところ」を直す（localStorage のキー名を最優先）。ドメイン3つの `FIELDS` とテーマ語彙を作り、ユーザーに見せて承認をもらう。
4. テストを新しい構成に合わせて直して通す。push。
5. ユーザーに `GEMINI_API_KEY` の登録を頼み、まず1ドメイン・少数（20問ほど）で生成して、速さと質を確認する。問題をユーザーに読んでもらう。
6. 質が良ければ、全ドメインに広げて、毎日の自動生成を動かす。

---

## 貼り付け用の指示文（新しいチャットの最初に送る）

> 添付の `HANDOFF-AZ900.md` を読んでください。「ビジキャリ 問題集」と同じ方式で、Microsoft の AZ-900 の試験対策アプリを作りたいです。手本のリポジトリは `Takuro-O/business-career` です。まず「4. 先に決めること」の4点を、1つずつ短く聞いてください。決まったら、提案→承認→実装の順で進めてください。

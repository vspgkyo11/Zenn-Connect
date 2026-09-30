---
name: zenn-publish-apply
description: Zenn 記事を公開（published: true → commit → push origin main、必要なら予約公開）し、社内の記事申請 Google Form（記事申請お申し込み）に自動で申請する。「記事を公開して申請」「◯◯の記事を 10/1 8:00 に公開」「記事申請フォームを出して」「記事手当の申請」などと言われたときに使う。
---

# Zenn 記事の公開＆記事申請フォーム送信

`scripts/zenn-publish-apply.mjs` で「記事の公開（git）」と「記事申請フォームの送信（ブラウザ自動操作）」を行う。
人間向けの手順書は `docs/publish_apply_guide.md`、設計判断の理由は `docs/adr/0004-publish-apply-automation.md`。

## まず押さえること（過去の運用で分かったこと）

- **フォーム送信はユーザーの Mac でしか動かない。** Claude Code on the web などのクラウド環境からは
  docs.google.com / zenn.dev に接続できず、Google ログインもできない。クラウド環境で Claude がやるのは
  **git 工程（公開フラグ変更・push）まで**。フォーム送信は、ユーザーが手元で打つコマンドを提示する。
  ローカルの Claude Code で動いている場合は、Claude がそのまま実行してよい。
- **クラウド環境は放置すると破棄される**ので、長時間の待機（`--at` まで待つ）をクラウドでやらない。
  公開時刻を指定したい場合は `--reserve`（Zenn の予約公開 `published_at`）を使う。
- **記事カテゴリーは単一選択（ラジオボタン）。** `--category` は必ず1つ。
- **送信時に reCAPTCHA が出ることがある**ので、本番送信は `--headed` 付きを案内する。
- ユーザーはスクリーンショットをファイルパスで伝えがち。`.zenn-publish/*.png` はユーザーの Mac 上にあり
  Claude からは見えないので、確認が必要なら画像をチャットに貼ってもらう。

## 手順

### 1. 対象記事を特定する
- slug が指定されていればそれを使う。タイトルや URL（`https://zenn.dev/ykbone/articles/<slug>`）から slug を取り出してもよい。
- 曖昧なら候補を出して確定させる（推測で進めない）。
  ```bash
  node scripts/zenn-publish-apply.mjs list   # published: false の記事一覧
  ```

### 2. パラメータを確定する
| 項目 | 決め方 |
| --- | --- |
| `--slug` | 手順1で確定したもの |
| `--at` | 公開日時（JST、例 `"2026/10/01 07:00"`）。フォームの「投稿日」にもこの日付が入る。省略すると現在時刻 |
| `--category` | 記事本文・topics から最も適したものを **1つ** 選ぶ。迷ったらユーザーに確認 |
| 実行モード | 下の「実行パターン」から選ぶ |

カテゴリーの選択肢（表記は完全一致）:
最新技術トレンド / チュートリアル・ハウツー / プログラミング言語 / フロントエンド開発 / バックエンド開発 / クラウド・インフラ / AI・機械学習 / データベース / データサイエンス / DevOps・CI/CD / モバイルアプリ開発 / Web開発のベストプラクティス / セキュリティ / ゲーム開発 / キャリア / その他

### 3. 実行内容を提示して承認を得る
push とフォーム送信は取り消しが難しい外部操作。以下を表で見せて OK をもらってから実行する。
記事 slug / タイトル / 公開URL / 公開日時 / カテゴリー / 実行パターン

### 4. 実行パターン

**A. 今すぐ公開して申請（最も簡単）**
```bash
npm run publish:apply -- run --slug <slug> --category "<カテゴリー>" --headed
```
push → 公開URLが 200 を返すまで待機（最大10分）→ フォーム送信。

**B. 指定時刻に公開（予約公開）＋ 公開後に申請** — クラウド環境の Claude が関わるときの標準
1. git 工程（Claude がクラウドで実行してよい）:
   ```bash
   node scripts/zenn-publish-apply.mjs run --slug <slug> --at "<日時>" --reserve --skip-form --category "<カテゴリー>"
   ```
   → `published: true` と `published_at: <日時>` が push され、Zenn がその時刻に公開する。
2. フォーム送信（ユーザーが公開時刻以降に手元で実行）:
   ```bash
   npm run publish:apply -- run --slug <slug> --skip-git --category "<カテゴリー>" --headed
   ```
   `--at` を付けないこと（未来の時刻を付けると、その時刻まで待機してしまう）。投稿日は実行日になる。

**C. 指定時刻まで待って公開→申請（手元の Mac で待機）**
```bash
caffeinate -i npm run publish:apply -- run --slug <slug> --at "<日時>" --category "<カテゴリー>" --headed
```
Mac をスリープさせず、ターミナルも閉じないこと。

**予約公開を取り消して今すぐ公開したい場合**: 記事の front matter から `published_at:` 行を削除して commit / push する。

### 5. 初回・久しぶりの実行時の事前確認
1. `npm run publish:apply -- login` → 開いたブラウザで yuichi.kobayashi@onewedge.co.jp にログイン → **ウィンドウを閉じる**（閉じるまでコマンドは終わらない）
2. dry-run（入力のみ・送信しない）で入力内容をスクリーンショット確認:
   ```bash
   npm run publish:apply -- run --slug <slug> --skip-git --category "<カテゴリー>" --dry-run --headed
   ```
   `.zenn-publish/*-filled.png` を開いてもらい、氏名・投稿日・カテゴリー・「回答のコピーを自分宛に送信する」ON を確認。

### 6. 完了確認
- ログに「✅ 公開URLが 200 を返しました」「✅ フォーム送信完了」「🎉 すべての工程が完了しました」
- ユーザーに、記事が開けることと控えメール（回答のコピー）が届いたことを確認してもらう

## トラブルシューティング
| 症状 | 対応 |
| --- | --- |
| `Google 未ログインです` | 手順5-1 の `login` をやり直す |
| `現在のブランチが〜` | `git checkout main` |
| `「◯◯」を選択できませんでした` / `選択肢「◯◯」が見つかりません` | エラーに出る「検出した選択肢」「質問欄の文言」でフォーム変更を確認し、スクリプトを修正 |
| `フォーム上で見つからなかった項目` | フォームの質問文が変わった可能性。`submitForm` の `fields` のラベルを実物に合わせる |
| `記事カテゴリーは単一選択です` | `--category` を1つにする |
| 送信で止まる | reCAPTCHA の可能性。`--headed` で手動対応 |
| 公開URLが 200 にならない | 予約公開の時刻前か Zenn の同期待ち。`published_at` と push 状況を確認 |

## 設定
リポジトリ直下の `.env.zenn-publish`（git 管理外。雛形は `.env.zenn-publish.example`）で
Zenn ユーザー名（既定 `ykbone`）・氏名・メール・フォームURL等を上書きできる。パスワードは絶対にコミットしない。

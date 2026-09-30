---
name: zenn-publish-apply
description: Zenn 記事を指定日時に公開（published: true → commit → push origin main）し、社内の記事申請 Google Form に自動で申請する。「記事を公開して申請」「◯◯の記事を 10/1 8:00 に公開」「記事申請フォームを出して」などと言われたときに使う。
---

# Zenn 記事の公開＆記事申請フォーム送信

`scripts/zenn-publish-apply.mjs` を使って、以下を一括実行する。

1. 対象記事（slug / タイトル）の特定
2. 公開URL `https://zenn.dev/<ZENN_USERNAME>/articles/<slug>` の生成
3. 指定日時（JST）まで待機
4. `published: true` に変更 → `git commit` → `git push origin main`
5. 記事申請 Google Form に入力して送信（「回答のコピーを自分宛に送信する」は必ず ON）

## 手順

### 1. 対象記事を特定する
- ユーザーが slug を指定していればそれを使う。タイトルやキーワードだけなら次で候補を出して確定させる。
  ```bash
  node scripts/zenn-publish-apply.mjs list
  ```
- 候補が複数ある／曖昧な場合は、推測で進めずユーザーに確認する。

### 2. パラメータを確定する
| 項目 | 決め方 |
| --- | --- |
| `--slug` | 手順1で確定したもの |
| `--at` | ユーザー指定の日時（例 `"2026/10/01 08:00"`、JST）。未指定なら即時実行でよいか確認する |
| `--category` | 記事本文・topics を読み、下の選択肢から該当するものをカンマ区切りで選ぶ（複数可） |
| `--reserve` | PC を起動しっぱなしにできない場合に提案する（下記「実行モード」参照） |

記事カテゴリーの選択肢（この表記と完全一致させる）:
最新技術トレンド / チュートリアル・ハウツー / プログラミング言語 / フロントエンド開発 / バックエンド開発 / クラウド・インフラ / AI・機械学習 / データベース / データサイエンス / DevOps・CI/CD / モバイルアプリ開発 / Web開発のベストプラクティス / セキュリティ / ゲーム開発 / キャリア

### 3. 実行内容をユーザーに提示して承認を得る
push とフォーム送信は取り消しが難しい外部操作なので、必ず以下を見せて OK をもらってから実行する。
記事 slug / タイトル / 公開URL / 実行日時 / カテゴリー / 実行モード

### 4. 事前チェック
```bash
node scripts/zenn-publish-apply.mjs check --slug <slug> --category "<カテゴリー>"
```
- 「Google 未ログインです」と出たら、ユーザーに `node scripts/zenn-publish-apply.mjs login` を実行して
  ブラウザで `yuichi.kobayashi@onewedge.co.jp` にログインしてもらう（初回のみ。以後はプロファイルに保存される）。
- 「現在のブランチが〜」と出たら main に切り替えるようユーザーに伝える。
- 初回はフォーム構造の確認のため `--dry-run --skip-git` で入力だけ行い、`.zenn-publish/` のスクリーンショットを確認するとよい。

### 5. 実行
指定日時まで待機するので、**Bash の `run_in_background` で起動**する。
```bash
node scripts/zenn-publish-apply.mjs run --slug <slug> --at "<YYYY/MM/DD HH:mm>" --category "<カテゴリー>"
```
完了後はログ末尾の「✅ フォーム送信完了」「🎉 すべての工程が完了しました」を確認し、
`.zenn-publish/*-submitted.png` と控えメールの確認をユーザーに促す。失敗時は `*-error.png` を読んで原因を報告する。

## 実行モード
- **既定（待機モード）**: `--at` の時刻までプロセスが待機し、時刻になったら push → 公開URLの反映を待つ → フォーム送信。
  実行中は PC をスリープさせないこと（macOS なら `caffeinate -i node scripts/...` で起動すると確実）。
- **予約公開モード（`--reserve`）**: 待機せず今すぐ `published: true` と `published_at: <日時>` を push し、
  Zenn の予約公開機能で `--at` の時刻に公開させる。フォームも即時送信する（投稿日は `--at` の日付）。PC を起動しておく必要がない。

## やり直し用オプション
- `--skip-git`: 公開は済んでいて、フォーム送信だけやり直したいとき
- `--skip-form`: 公開（push）だけしたいとき
- `--headed`: ブラウザを表示して実行（2 段階認証が必要なときなど）
- `--no-verify-url`: push 後の公開URL 200 確認を省略

## 設定
リポジトリ直下の `.env.zenn-publish`（git 管理外。雛形は `.env.zenn-publish.example`）で
Zenn ユーザー名・氏名・メール・Google パスワード等を上書きできる。パスワードは絶対にコミットしない。

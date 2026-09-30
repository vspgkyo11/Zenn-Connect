# 記事公開＆記事申請フォーム送信の手順

Zenn 記事の公開（`published: true` → commit → push）と、社内の記事申請 Google Form
「記事申請お申し込み」への申請を `scripts/zenn-publish-apply.mjs` で自動化しています。
Claude Code からはスキル `/zenn-publish-apply` で呼び出せます。

> 設計判断の理由（なぜ Playwright か、なぜ手元の Mac で動かすか等）は
> [ADR-0004](./adr/0004-publish-apply-automation.md) を参照。

---

## 1. 初回セットアップ（1回だけ）

```bash
npm install
cp .env.zenn-publish.example .env.zenn-publish   # 必要なら値を編集（git 管理外）
npm run publish:apply -- login
```

`login` でブラウザ（Google Chrome）が開くので、`yuichi.kobayashi@onewedge.co.jp` でログインし、
フォームが表示されたら **ウィンドウを閉じる**（閉じるとログイン状態が `~/.zenn-publish/chrome-profile` に保存される）。

## 2. 使い方

| やりたいこと | コマンド |
| --- | --- |
| 未公開記事の一覧 | `npm run publish:apply -- list` |
| 今すぐ公開して申請 | `npm run publish:apply -- run --slug <slug> --category "<カテゴリー>" --headed` |
| 指定時刻に予約公開だけ push | `npm run publish:apply -- run --slug <slug> --at "2026/10/01 07:00" --reserve --skip-form --category "<カテゴリー>"` |
| 公開済み記事の申請だけ | `npm run publish:apply -- run --slug <slug> --skip-git --category "<カテゴリー>" --headed` |
| 指定時刻まで待って公開→申請 | `caffeinate -i npm run publish:apply -- run --slug <slug> --at "2026/10/01 07:00" --category "<カテゴリー>" --headed` |
| 入力内容の確認だけ（送信しない） | 上記に `--dry-run` を付ける（git は変更せず、公開URL確認も省略される） |
| 事前チェック | `npm run publish:apply -- check --slug <slug> --category "<カテゴリー>"` |

- `--at` は JST。フォームの「投稿日」にもこの日付が入る（省略時は実行日）。
- `--at` に未来の時刻を付けて `--reserve` を付けないと、その時刻まで**待機**する（Mac のスリープ厳禁）。
- 予約公開を取りやめて今すぐ公開したいときは、記事の `published_at:` 行を削除して push する。
- スクリーンショットは `.zenn-publish/` に保存される（`*-filled.png` 入力後 / `*-submitted.png` 送信後 / `*-error.png` 失敗時）。

## 3. フォームの入力内容

| フォーム項目 | 入力値 |
| --- | --- |
| メールアドレス | `FORM_EMAIL`（yuichi.kobayashi@onewedge.co.jp） |
| 申請種別 | 新規申請（`FORM_APPLICATION_TYPE` で変更可。修正時は「再申請」） |
| 氏名 | `FORM_NAME`（小林 勇一 ※姓名の間は半角スペース） |
| 投稿日 | `--at` の日付 |
| 記事のタイトル | 記事 front matter の `title` |
| 既に作成済みの記事URLの添付 | `https://zenn.dev/ykbone/articles/<slug>` |
| 記事カテゴリー | `--category`（**単一選択**。省略時は topics から推定） |
| 質問・要望など | 空欄 |
| 回答のコピーを自分宛に送信する | 必ず ON（控えメールで送信完了を確認するため） |

カテゴリーの選択肢: 最新技術トレンド / チュートリアル・ハウツー / プログラミング言語 / フロントエンド開発 /
バックエンド開発 / クラウド・インフラ / AI・機械学習 / データベース / データサイエンス / DevOps・CI/CD /
モバイルアプリ開発 / Web開発のベストプラクティス / セキュリティ / ゲーム開発 / キャリア / その他

## 4. 完了確認

1. ログに `✅ フォーム送信完了` と `🎉 すべての工程が完了しました`
2. 記事URLが開ける
3. 控えメール（回答のコピー）が届いている

## 5. 注意点

- **フォーム送信は手元の Mac で実行する。** Claude Code on the web などのクラウド環境からは
  Google Forms / zenn.dev に接続できない。クラウドの Claude に頼む場合は、git 工程（予約公開の push）までを任せ、
  フォーム送信は手元で実行する。
- 送信時に reCAPTCHA が出ることがあるので、本番は `--headed`（ブラウザ表示）で実行し、出たら手で通す。
- 申請ルール（フォーム記載）: 1人あたり週1記事・月3記事まで、締切は毎月20日（第3週まで）。
- フォームの質問文・選択肢が変わるとエラーで止まる。エラーに出る「検出した選択肢」を見てスクリプトを直す。

## 6. 実績

| 日付 | 記事 | 備考 |
| --- | --- | --- |
| 2026-10-01 | `202610-security-hacking-openai` | 初回運用。予約公開を解除して即時公開 → フォーム送信・控えメール受信を確認 |

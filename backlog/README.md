# backlog/

当面公開しない下書きの置き場です。Zenn には同期されません（運用ルールは [docs/repository_guide.md](../docs/repository_guide.md) §6）。
公開するときは `YYYYMM-ジャンル-キーワード` のスラッグを付けて `articles/` へ `git mv` します。

| ファイル | 内容 | 公開前にやること |
| --- | --- | --- |
| `ai/vscode-mcp-context7-setup.md` | VS Code × MCP × Context7 の環境構築（前編） | **技術内容の裏取りが必須**（下記） |
| `ai/vscode-mcp-context7-practice.md` | 同・Next.js / Laravel での活用（実践編） | 前編の裏取り結果に合わせて直す。前編へのリンクを入れる |
| `gas/gas-scope-guide.md` | GAS の変数・定数スコープ | — |
| `mail/html-mail-carrier-images.md` | キャリアメールで HTML メールの画像が出ない理由 | — |
| `mysql/mysql-docker-error.md` | macOS の Docker + MySQL 接続エラー | — |
| `mysql/rentalserver-mysql-migration.md` | レンタルサーバーの sql_mode が緩い理由（WordPress MySQL 8 移行シリーズ） | 文体が「である」調のまま。冒頭の `# 見出し` を外す |
| `mysql/wordpress-sqlmode.md` | WordPress が sql_mode を自分で外す仕組み（同シリーズ・後日譚） | スラッグに注意（下記） |
| `nextjs/prisma-nextjs-build-error.md` | Prisma 7 の Custom Output でビルドが落ちる件 | — |
| `windows/linux-windows-appstore.md` | アプリストア視点の乗り換え先 OS 比較 | — |
| `zenn/zenn-markdown-cheatsheet.md` | Zenn の Markdown 記法一覧（自分用メモ） | — |

## 公開前の注意

### WordPress MySQL 8 移行シリーズ

シリーズの本編は公開済みの [1a1325fa179bc6](../articles/1a1325fa179bc6.md)（事前調査）です。

- 本編の「おわりに」は、後日譚として `https://zenn.dev/vspgkyo11/articles/cleansing-was-it-necessary` にリンクしています。**このスラッグの記事はまだ存在しません。**
  `wordpress-sqlmode.md` を公開するときは、スラッグを `cleansing-was-it-necessary` にするか、命名規則どおりのスラッグで公開して本編のリンクを書き換えます。
- `rentalserver-mysql-migration.md` も同じ URL にリンクしています。上と合わせて直します。

### VS Code × MCP × Context7 の2本

2026-10-11 に、4つの版（構築編・実践編・概要版・詳細版）を前編と実践編の2本に統合しました。文章をまとめただけで、**技術的な記述は裏取りしていません**。
次の記述は実際の仕様と食い違っている疑いがあります。公開前に公式ドキュメントで確認してください。

- **Context7 の位置づけ**: 記事は「ローカルのファイルを監視して ChatGPT に同期するツール」として書いています。Context7（Upstash）は、ライブラリの最新ドキュメントを取得して AI に渡す MCP サーバーのはずです。`brew install context7`、`@context7/cli`、`context7 login` / `connect chatgpt` / `watch`、`context7.yaml`、ChatGPT の「Connected sources」に表示される、という記述は要確認です。
- **VS Code の MCP 設定**: 記事は `settings.json` の `mcp.servers` と「MCP 対応拡張」を前提にしています。現在の VS Code は `.vscode/mcp.json`（キーは `servers`）で設定する方式のはずです。
- **`@modelcontextprotocol/server-filesystem` の引数**: 記事は `--root <dir>` と書いています。許可ディレクトリは位置引数で渡す仕様のはずです。
- **`@modelcontextprotocol/server-openapi`**: 公式パッケージとして存在するか要確認です。
- **体験談**: 「この環境を整えてからは〜」の部分は、実際に試した内容に合わせて書き直してください。

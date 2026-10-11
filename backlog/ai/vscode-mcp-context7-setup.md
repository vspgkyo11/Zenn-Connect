---
title: "【VS Code×MCP×Context7】最新ドキュメントを読める AI コーディング環境構築"
emoji: "📘"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["context7"]
published: false
---

## はじめに

AI 補助によるコーディングは広く普及していますが、実際の開発現場では次のような課題が頻繁に発生します。

* API 仕様書を参照していないため、パラメータ名が誤っている
* 最新の DB スキーマに基づかないコードを提案される
* プロジェクト固有の命名規則を理解せず、修正に手間がかかる

これらの問題は「AI がプロジェクトの文脈を理解していない」ことが本質的な原因です。プロジェクトごとの仕様変更、API バージョン差、設計書の更新などは、インターネット上の一般情報には反映されません。とくに Next.js のように日々アップデートが行われるフレームワークでは、オンライン上の情報が古いケースも多くあります。

もし AI がローカルのドキュメントを正確に読み取り、設計書やスキーマの内容を踏まえて回答してくれれば、開発体験は大きく向上します。その鍵となる技術が Model Context Protocol（MCP）です。本記事では VS Code、MCP サーバー、Context7 を組み合わせて、AI がローカル環境の資料を参照しながらコーディングを支援する環境構築手順を解説します。

この記事のゴールは次の二つです。

* VS Code へ MCP を導入し、ローカルサーバーと接続できるようにする
* Context7 を用いてプロジェクト資料（`docs/`、schema、API 仕様）を AI と同期させる

Next.js や Laravel のプロジェクトでの具体的な使い方は、実践編の記事で紹介します。

:::message
拡張機能や MCP サーバーの UI 名称・設定キーはバージョンで変わることがあります。本記事では代表的な設定例を示します。
:::

## 対象者

* VS Code を普段使いしている
* Next.js または Laravel のいずれかを利用している
* AI にプロジェクトの背景知識（仕様書・スキーマ）を与えたい
* MCP や Context7 を触った経験が少ない、または基礎から理解したい

## MCP とは何か

Model Context Protocol は、AI がローカル環境のファイルや外部ツールへアクセスできるようにするための統一的な仕組みです。LLM クライアントと、外部の「リソース（ローカル/リモートファイル等）」「ツール（API・DB・コマンド等）」を JSON-RPC で接続するオープンなプロトコルとして設計されています。

例えば、AI に次のような指示を行った場合を考えます。

* DB スキーマを踏まえて TypeScript 型を作成してほしい
* 設計資料を参照しながら API ハンドラを生成してほしい

通常であれば、AI はこれらのファイルを参照できません。しかし MCP によって AI がローカルの資料を直接読み取れるようになれば、仕様に即した正確なアウトプットが期待できます。

### 従来のプラグインとの違い

プラグインごとの個別実装ではなく、標準化されたプロトコルを介して各種サーバー（`server-filesystem`、`server-openapi`、`server-postgres` など）を横断的に利用できます。

### 橋渡しの仕組み

1. MCP サーバーが「参照可能なパスやツール」を公開する
2. LLM クライアント（VS Code 拡張など）がユーザーに確認を取りながら読み取り・実行する
3. 必要なスニペットだけが会話に反映される

クライアントは「どのファイル・どの API を参照したか」を明示できるため、回答の根拠を追いやすくなります。

### 他エディタ（Cursor 等）との比較

Cursor などのエディタも文脈参照機能を持っていますが、MCP は VS Code を含む複数のツールと連携できる点に汎用性があります。既存環境を変えずに AI 連携を強化したい開発者に向いています。

| | 内容 |
| --- | --- |
| メリット | 標準プロトコルで拡張が容易、参照の透明性、ツールの再利用性 |
| デメリット | 初期設定がやや増える、各サーバーごとの権限やルート設定が必要 |

## VS Code に MCP 拡張を導入する

### インストール手順

1. VS Code の拡張機能から MCP 対応クライアント拡張をインストールします（例：「Anthropic Claude for VS Code」「OpenAI ChatGPT for VS Code」など、MCP 対応版）。
2. コマンドパレットで「MCP」「Servers」「Tools」などのパネルを開けることを確認します。

多くのクライアントは `settings.json` または専用設定画面から MCP サーバーの起動方法を登録します。拡張によってキー名は異なるため、後述の設定例は読み替えてください。

### よくあるエラー

* **Port already in use**：ソケット接続型のサーバーでポートが競合しています。`transport: "stdio"` に切り替えるか、ポート番号を変更します。
* **JSON RPC Error**：コマンドパスの誤り、Node/Python 未インストール、環境変数未設定、作業ディレクトリの相違が主な原因です。
* **Permission denied**（Windows/macOS）：実行権限やシェル差異（PowerShell/WSL）に注意します。

エラーが出た場合は、設定ファイルとポート番号を確認することが最初の解決策になります。

## MCP サーバーをローカルで動かす

MCP サーバーには複数の種類があります。

* `@modelcontextprotocol/server-filesystem`（ローカルファイル参照）
* `@modelcontextprotocol/server-openapi`（OpenAPI 仕様参照）
* `@modelcontextprotocol/server-git`（Git 情報）

初学者でも扱いやすく、かつ最も重要なのがローカルファイル参照です。まずは `server-filesystem` を使い、参照を許可するルートを限定します。

### VS Code 設定例（settings.json）

Node/npm を使った stdio 起動（クライアントが自動起動）の例です。

```json
{
  "mcp.servers": {
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "--root", "${workspaceFolder}/docs",
        "--root", "${workspaceFolder}/prisma",
        "--root", "${workspaceFolder}/app",
        "--root", "${workspaceFolder}/domain"
      ],
      "cwd": "${workspaceFolder}"
    },
    "openapi": {
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-openapi",
        "--spec", "${workspaceFolder}/docs/api.yaml"
      ],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

* `--root` は参照を許可する読み取りルートです。必要最小限に絞ります。
* `openapi` は API 仕様書（`docs/api.yaml` など）を参照可能にします。

### 起動コマンド例

```bash
# Node
npx -y @modelcontextprotocol/server-filesystem --root ./docs --root ./prisma

# Bun
bunx @modelcontextprotocol/server-filesystem --root ./docs
```

多くの VS Code クライアントは設定から自動起動するため、手動での常駐は不要です。一度設定すれば VS Code 起動時に自動的に接続されるため、日常開発へ自然に組み込むことができます。

独自サーバーや拡張サーバーを常駐させたい場合は、pm2 や nodemon を使います。

```bash
pm2 start "npx -y @modelcontextprotocol/server-filesystem --root ./docs --root ./prisma" --name mcp-fs
```

## Context7 の接続設定

Context7 は、ローカルのドキュメントやコードを安全に監視・インデックスして、ChatGPT 側（Connected sources）で検索・参照できるようにする補助ツールです。MCP のファイル参照と併用することで、対話からの「ドキュメント探索 → 根拠提示」が安定します。

### インストール

```bash
# macOS（Homebrew）
brew install context7

# npm
npm i -g @context7/cli
```

公式ドキュメントの最新インストール手順に従ってください。

### VS Code → ChatGPT の連携

1. `context7 login`（ブラウザで認可）
2. `context7 connect chatgpt`（ChatGPT 側の連携を承認）
3. 組織/ワークスペースを選択（必要に応じて）

### プロジェクトフォルダの監視を有効化

監視対象として、以下のような構成が一般的です。

```
project-root/
  docs/
  prisma/schema.prisma
  app/
  routes/
  README.md
```

`context7.yaml` をプロジェクト直下に用意し、監視対象を定義します。

```yaml
project: my-next-app
watch:
  - path: docs
    glob: "**/*.md"
    exclude:
      - "**/node_modules/**"
      - "**/.git/**"
      - "**/.next/**"
  - path: prisma/schema.prisma
  - path: app/api
    glob: "**/*.{ts,tsx}"
  - path: domain
    glob: "**/*.{ts,tsx}"
  - path: README.md
```

```bash
context7 watch --config ./context7.yaml
```

### ChatGPT 側の「Connected sources」確認

ChatGPT の設定または会話画面の情報パネルに、`Context7 (my-next-app)` のようなソースが表示され、検索時に参照元として出てくれば接続完了です。

## ドキュメント同期の仕組み

Context7 はファイルシステムの変更を監視し、更新があれば AI 側へ同期します。

* **ウォッチャー（ファイル更新検知）**：`context7 watch` は変更を自動検知し、インデックスを更新します。MCP の `server-filesystem` は参照時に最新ファイルを読み出します。
* **path mapping の意味**：MCP の `--root` は「AI が参照できる安全なルート範囲」を定義します。Context7 は `watch.path` と「Connected source」の対応付けで検索可能範囲を決めます。

### 同期対象にするもの・除外するもの

| | パス | 理由 |
| --- | --- | --- |
| 同期する | `docs/`（設計資料・仕様書・公式ドキュメントのローカルコピー） | 回答の根拠になる一次情報 |
| 同期する | `prisma/schema.prisma`、Migration | データ構造の正 |
| 同期する | `app/api/**`、`domain/**`（Next.js） | API 設計と自作レイヤ（DTO/UseCase/Service など） |
| 同期する | Controller、Request、`routes/`（Laravel） | バリデーションとルーティングの正 |
| 同期する | `README.md`、OpenAPI 形式の API 仕様書 | プロジェクト全体の前提 |
| 除外する | `node_modules/`、`vendor/`、`storage/` | 容量が大きく、同期処理の品質に影響する |
| 除外する | `.next/`、`.git/`、`public/build/` | 巨大・自動生成物 |

## フレームワーク公式ドキュメントを AI に参照させる手順

Next.js のようなフレームワーク公式ドキュメントを AI に参照させるには、ローカルへの保存と Context7 側での同期設定が必要になります。ここでは Next.js を例に、具体的な手順を整理します。

### 1. 参照したい公式ドキュメント範囲を決める

App Router、Route Handler、Metadata、Server Actions など、実際の開発でよく使うトピックを優先します。すべてを保存しようとせず、「よく使う基本機能」「今のプロジェクトで使う機能」に絞ると管理がしやすくなります。

### 2. ドキュメントをローカルに保存する

ブラウザで Next.js の公式サイトを開き、必要なページごとに Markdown や HTML として保存します。単純にコピーペーストして `.md` ファイルに貼り付ける方法でも構いません。

```
docs/nextjs/app-router.md
docs/nextjs/route-handlers.md
docs/nextjs/server-components.md
```

### 3. プロジェクト内に docs ディレクトリを用意する

Next.js プロジェクト直下に `docs` ディレクトリを作成します。フレームワーク別、用途別にサブディレクトリを分けると参照しやすくなります。

```
docs/nextjs/
docs/project/
docs/design/
```

### 4. ファイル名と構成を分かりやすくする

ファイル名にトピック名を含めると、後から「どのドキュメントを参照しているか」が一目で分かります（例：`app-router-basics.md`、`route-handlers-api-rules.md`）。同じトピックでバージョンが変わる場合は v14、v15 のようにバージョンを明記します。

### 5. Context7 の同期対象に docs ディレクトリを追加する

Context7 の watcher の対象パスに `./docs/nextjs`、`./docs/project` を指定します。これにより、`docs` 配下のファイル更新が自動的に AI の参照コンテキストに反映されます。

### 6. AI に「どのドキュメントを参照してほしいか」を明示する

実際にプロンプトを書くときは、参照してほしいファイルを文中で指定します。

* `docs/nextjs/route-handlers.md` を前提に、users 一覧の Route Handler を作成してください
* `docs/nextjs/app-router.md` と `docs/project/api-design.md` を参照して、`/projects` の API を設計してください

こうすることで、AI はローカルの公式ドキュメントを優先して回答してくれるようになります。

この手順を一度整えておくと、フレームワークがアップデートされたときも、必要なページだけを差し替えれば済みます。日々の開発では「新しい仕様を docs に落とし込む → AI にも即座に反映される」という循環がつくれるようになります。

## ChatGPT 側でドキュメントを参照させてコーディングする

Context7 によりドキュメントが参照可能になると、ChatGPT に対して次のような実用的な指示が可能になります。

* 「このプロジェクトの API 仕様（`docs/api.yaml`）に沿って `app/api/users/route.ts` の POST を実装して。必要なら `prisma/schema.prisma` を参照し、`User` モデルの制約を満たすバリデーションを入れて。」
* 「`prisma/schema.prisma` を読んで TypeScript の DTO と Zod スキーマを `domain/` に生成して。既存の命名規則があれば合わせて。」
* 「`app/api/**` と `docs/` の整合性をチェックして、未実装エンドポイントとレスポンス差分を一覧化して。」

### 参照ログの見方

MCP/Context7 対応クライアントでは、メッセージに「参照したドキュメント（Connected sources / MCP resources）」が明示されます。どのファイルが読まれたかを確認し、誤参照ならパスを指定し直します。

## ハマりポイントと対処

| 症状 | 原因と対処 |
| --- | --- |
| JSON-RPC エラー | `command` の解決失敗。`npx` の実行可否、`PATH`、プロキシ環境を確認する |
| JSON-RPC エラー（相対パス） | `args` の相対パスと `cwd` の不一致。`cwd: "${workspaceFolder}"` を指定する |
| ポート競合 | 別の MCP サーバーが同じポートで起動している。ポート変更、または `transport: "stdio"` に切り替える |
| watcher が動作しない | `context7.yaml` の `glob`/`exclude` を見直し、監視開始コマンドを再起動する |
| 更新が拾われない | `server-filesystem` は都度読み取りのため通常は再起動不要。独自サーバーは `nodemon` 等のホットリロードを併用する |
| マルチルート構成で参照先がずれる | `${workspaceFolder}` の解決先に注意。必要なら絶対パスを指定する |
| 巨大ディレクトリを読み込んでしまう | MCP の `--root` を最小限にし、Context7 の `exclude` を厳格化する。バイナリ・ビルド成果物は除外する |

## セキュリティ面について

### データフローの基本

* MCP は「参照の可視化・最小化・ユーザー承認」を重視していますが、モデルがクラウドの場合、参照されたファイル内容（必要な断片）は最終的にモデルへ送信されます。
* Context7 も、原則として必要なスニペットだけを会話へ取り込みますが、ポリシーと設定次第で送信が抑制・制御されます。

### ベストプラクティス

* `--root` を必要最小限に限定する
* `exclude` で秘密情報・鍵・環境変数（`.env`、`next.config.js` 内の秘匿値など）を厳格に除外する
* クライアント側の「アップロード前の明示承認」を有効化する
* 企業内用途では、オンプレ/閉域モデルの利用を検討する

「誰が何を参照したか」をログ化しやすいため、DLP や監査と併用すればコンプライアンス運用もしやすくなります。

## クイックスタート（Next.js）

1. VS Code に MCP 対応拡張を入れる
2. `settings.json` に `server-filesystem` を登録する（`--root` は `docs`、`prisma`、`app`、`domain` など最小限）
3. Context7 を導入し、`context7.yaml` で監視・除外を定義して `context7 watch` を実行する
4. ChatGPT で「Connected sources」を確認する
5. 会話で「このプロジェクトの仕様（`docs/...`）に沿って〜」と明示し、参照ログを逐次確認する
6. `app/api/**` と `schema.prisma` を参照しながら、API・型・テストを生成し、整合性をチェックする

## おわりに

AI にローカルドキュメントを参照させながら開発できる環境は、これからのソフトウェア開発において標準的なスタイルになっていくと思います。とくに Next.js のように急速に進化するフレームワークでは、公式情報を常に参照できる環境は大きな安心材料になります。

私自身、この環境を整えてからは、ドキュメントを行ったり来たりする手間が減り、開発の集中力を途切れさせることも少なくなりました。回答が「自分のプロジェクトの一次情報」に根ざすため、仕様ズレや古い情報の混入が減り、レビューやリファクタでの認識齟齬も減りました。

まずは小規模プロジェクトから、`server-filesystem` と最小限の `--root` で始めてみてください。次の記事では、この環境を Next.js と Laravel のプロジェクトでどのように活用するか、具体的な手順と実践例を紹介します。

---

## 株式会社ONE WEDGE
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/

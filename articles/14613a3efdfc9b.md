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

これらの問題は「AI がプロジェクトの文脈を理解していない」ことが本質的な原因です。もし AI がローカルのドキュメントを正確に読み取り、設計書やスキーマの内容を踏まえて回答してくれれば、開発体験は大きく向上します。

その鍵となる技術が Model Context Protocol（MCP）です。本記事では VS Code、MCP サーバー、Context7 を組み合わせて、AI がローカル環境の資料を参照しながらコーディングを支援する環境構築手順を解説します。

この記事の目的は次の三つです。

* VS Code へ MCP を導入し、ローカルサーバーと接続できるようにする
* Context7 を用いてプロジェクト資料を AI と同期させる
* Next.js や Laravel を題材に、実践的な活用例を紹介する

## 対象者

本記事は次のような読者を想定しています。

* VS Code を普段使いしている
* Next.js または Laravel のいずれかを利用している
* AI にプロジェクトの背景知識を与えたい
* MCP を触った経験が少ない、または基礎から理解したい

## MCP とは何か

Model Context Protocol は、AI がローカル環境のファイルや外部ツールへアクセスできるようにするための統一的な仕組みです。従来のプラグイン方式とは異なり、エディタ依存の拡張ではなく、AI とツールを結ぶ標準的なプロトコルとして設計されています。

例えば、AI に次のような指示を行った場合を考えます。

* DB スキーマを踏まえて TypeScript 型を作成してほしい
* 設計資料を参照しながら API ハンドラを生成してほしい

通常であれば、AI はこれらのファイルを参照できません。しかし MCP によって AI がローカルの資料を直接読み取れるようになれば、仕様に即した正確なアウトプットが期待できます。

Cursor などのエディタも文脈参照機能を持っていますが、MCP は VS Code を含む複数のツールと連携できる点に汎用性があります。既存環境を変えずに AI 連携を強化したい開発者に向いています。

## VS Code に MCP 拡張を導入する

VS Code Marketplace から MCP 対応拡張をインストールします。導入後は MCP Servers パネルが利用可能となり、ここでローカルの MCP サーバーを登録します。

よくある問題としては次のようなものがあります。

* サーバー起動中のポートと競合して接続できない
* JSON 設定ファイルのパスが誤っている
* 権限不足でファイルアクセスに失敗する

エラーが出た場合は、設定ファイルとポート番号を確認することが最初の解決策になります。

## MCP サーバーをローカルで動かす

MCP サーバーには複数の種類がありますが、初学者でも扱いやすいのは local-files 系のサーバーです。これは指定したディレクトリ内のファイルを AI に参照させるためのものです。

設定の流れは次の通りです。

* 対象ディレクトリや権限を JSON ファイルで定義する
* Node、Python、Bun などでサーバーを起動する
* pm2 または nodemon でプロセスを常駐させる

一度設定すれば VS Code 起動時に自動的に接続されるため、日常開発へ自然に組み込むことができます。

## Context7 の接続設定

Context7 は ChatGPT にローカルドキュメントを同期させるためのツールです。VS Code への拡張導入後、プロジェクトフォルダを監視対象に登録します。

監視設定の例として、以下のような構成が一般的です。

```
project-root/
  docs/
  prisma/schema.prisma
  app/
  routes/
  README.md
```

設定後、ChatGPT 側の画面に Connected sources が表示されていれば、同期が成功しています。

## ドキュメント同期の仕組み

Context7 はファイルシステムの変更を監視し、更新があれば AI 側へ同期します。特に参照価値が高いのは次のようなファイルです。

* 設計資料や仕様書（docs）
* prisma/schema.prisma
* Laravel の Controller や Request ファイル
* Next.js の API ディレクトリ

一方で次のようなディレクトリは除外が適切です。

* node_modules
* vendor
* storage

これらは容量が大きく、同期処理の品質に影響するためです。

## ChatGPT 側でドキュメントを参照したコーディング例

Context7 によりドキュメントが参照可能になると、ChatGPT に対して次のような実用的な指示が可能になります。

* 設計資料に沿った API ハンドラの生成
* prisma schema を基にした型定義の作成
* Laravel の FormRequest を仕様書通りに生成
* 参照されたドキュメントのログ確認

AI はプロジェクト固有の文脈を理解したうえで回答するため、提案と実装の整合性が高まります。

## Next.js プロジェクトでの活用

Next.js は App Router、Server Components、API Routes など複数の概念が共存するため、依存関係が複雑になりがちです。Context7 を使って schema や設計資料を読ませることで、実装方針の統一やテストコード生成が円滑になります。

## Laravel プロジェクトでの活用

Laravel では Model、Controller、FormRequest、Migration が密接に関係します。これらをまとめて参照させることで、次のような効果が得られます。

* バリデーションルールの自動生成
* リレーション定義の整合性チェック
* Migration に基づく Seeder や Factory の自動作成

## プロジェクトの整合性チェック

AI がドキュメントとコードを同時に参照できることで、設計と実装の差分をレビューする役割も担えます。

* 設計資料に存在しないエンドポイントの検出
* 型の不一致や未更新部分の指摘
* 大規模リファクタリング時の依存関係可視化

実際の開発でも、設計資料とコードのズレに気付けず後工程で問題化するケースは多いため、大きな助けとなります。

## テストコード生成への応用

Next.js では Playwright や Vitest、Laravel では Feature や Unit テストが生成対象となります。ドキュメントを参照しながら生成されるため、期待値や前提条件を正確に踏まえたテストコードが得られます。

## ハマりポイントと対処

実運用ではいくつかの問題が発生しやすく、代表例として次が挙げられます。

* JSON-RPC 設定の誤りによる接続失敗
* ポート競合


---
## 1. はじめに

この記事は、初心者〜中級者のエンジニアが「迷わず設定できる」ことを最優先に、VS Code で MCP（Model Context Protocol）と Context7 を組み合わせ、ローカルの最新ドキュメント（仕様書、スキーマ、コード）を参照させながら AI にコーディングさせる手順をまとめたものです。対象は Next.js（App Router）プロジェクトです。

注意:
- 拡張機能や MCP サーバーの UI 名称・設定キーはバージョンで変わることがあります。ここでは代表的な設定例とベストプラクティスを示します。
- セキュリティと送信データについては「13. セキュリティ面について」を必ず確認してください。


- なぜ「AI が最新ドキュメントを読む」ことが重要か  
  プロジェクトごとの仕様変更、API バージョン差、設計書の更新などは、インターネット上の一般情報には反映されません。AI がローカルの一次情報（`docs/`, `schema.prisma`, `app/api/**` 等）を直接参照できるほど、回答はあなたのプロジェクトに最適化されます。

- 既存の ChatGPT / Copilot だけでは限界がある理由  
  単にエディタのテキストバッファやファイル名だけを参照する方式では、必要な全体像（仕様・設計ドキュメント・スキーマ）にアクセスしづらく、脈絡を誤るケースが多発します。

- MCP（Model Context Protocol）が解決する課題  
  MCP は LLM と外部ツール・ローカルリソースの橋渡しを標準化するプロトコルです。LLM クライアントから「リソース（ファイル）」「ツール（コマンド・API）」「プロンプト」などを安全に呼べるため、正確な参照・最小限の転送・ユーザー承認を前提に「正しい情報」を会話へ注入できます。

- 本記事で実現するゴール  
  - VS Code で MCP サーバー接続  
  - Context7 でローカル資料（`docs/`, `schema`, API 仕様）を参照しながらコーディング  
  - Next.js プロジェクトでの具体例

---

## 2. 対象者

- VS Code を使用している
- Next.js（App Router）で開発している
- 「AI にプロジェクトのドキュメントを理解させたい」人
- MCP を使ったことがない初学者〜中級者

---

## 3. MCP とは何か

- 概要  
  MCP（Model Context Protocol）は、LLM クライアントと外部の「リソース（ローカル/リモートファイル等）」「ツール（API・DB・コマンド等）」を JSON-RPC で接続するオープンなプロトコルです。クライアントは「どのファイル・どの API を参照したか」を明示でき、ユーザーの承認のもと最小限の断片を会話に取り込みます。

- 従来のプラグインとの違い  
  プラグイン個別実装ではなく、標準化されたプロトコルを介して各種サーバー（`server-filesystem`, `server-openapi`, `server-postgres` など）を横断的に利用できます。

- 橋渡しの仕組み  
  MCP サーバーが「参照可能なパスやツール」を公開 → LLM クライアント（VS Code 拡張など）がユーザーに確認を取りながら読み取り・実行 → 必要なスニペットだけ会話に反映。

- 「プロジェクト依存」になるメリット  
  回答が「あなたのプロジェクトの実ファイル・仕様」に準拠するため、的外れな一般論や旧仕様の混入が激減します。

- 他エディタ（Cursor 等）との比較  
  - メリット: 標準プロトコルで拡張が容易、参照の透明性、ツールの再利用性。  
  - デメリット: 初期設定がやや増える、各サーバーごとの権限やルート設定が必要。

---

# 手順編（実装ステップ）

## 4. VS Code に MCP 拡張を導入する

- インストール手順（代表例）  
  1) VS Code の拡張機能から MCP 対応クライアント拡張をインストール（例: 「Anthropic Claude for VS Code」「OpenAI ChatGPT for VS Code」など、MCP 対応版）。  
  2) コマンドパレットで「MCP」「Servers」「Tools」などのパネルを開けることを確認。

- “MCP Servers” パネルの初期設定  
  多くのクライアントは `settings.json` または専用設定画面から MCP サーバーの起動方法を登録します（下記は代表例。拡張によってキー名は異なるため読み替え）。

- よくあるエラー  
  - Port already in use: ソケット接続型のサーバーでポートが競合。`transport: "stdio"` に切り替えるか、ポート番号を変更。  
  - JSON RPC Error: コマンドパスの誤り、Node/Python 未インストール、環境変数未設定、作業ディレクトリの相違。  
  - Permission denied（Windows/macOS）: 実行権限やシェル差異（PowerShell/WSL）に注意。

---

## 5. MCP サーバーをローカルで動かす流れ

- MCP 対応サーバーの例  
  - `@modelcontextprotocol/server-filesystem`（ローカルファイル参照）  
  - `@modelcontextprotocol/server-openapi`（OpenAPI 仕様参照）  
  - `@modelcontextprotocol/server-git`（Git 情報）  
  このうち「ローカルファイル参照」は最重要です。

- ファイルベース（filesystem）をまず使う  
  `server-filesystem` を使い、参照を許可するルートを限定します。

- VS Code 設定例（`settings.json`）  
  例として Node/npm を使った stdio 起動（クライアントが自動起動）:
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
  - `--root` は参照を許可する読み取りルート（必要最小限に絞る）。
  - `openapi` は API 仕様書（`docs/api.yaml` など）を参照可能に。

- 起動コマンド例  
  - Node: `npx -y @modelcontextprotocol/server-filesystem --root ./docs --root ./prisma`  
  - Bun: `bunx @modelcontextprotocol/server-filesystem --root ./docs`  
  多くの VS Code クライアントは設定から自動起動するため、手動常駐は不要です。

- 永続化（pm2 / nodemon）  
  独自サーバーや拡張サーバーを常駐させたい場合:
  ```bash
  pm2 start "npx -y @modelcontextprotocol/server-filesystem --root ./docs --root ./prisma" --name mcp-fs
  ```

---

## 6. Context7 の接続設定

Context7 は、ローカルのドキュメントやコードを安全に監視・インデックスして、ChatGPT 側（Connected sources）で検索・参照できるようにする補助ツールです。MCP のファイル参照と併用することで、対話からの「ドキュメント探索→根拠提示」が安定します。

- インストール（例）
  - macOS（Homebrew 例）:
    ```bash
    brew install context7
    ```
  - npm 例:
    ```bash
    npm i -g @context7/cli
    ```
  公式ドキュメントの最新インストール手順に従ってください。

- VS Code → ChatGPT の連携  
  1) `context7 login`（ブラウザで認可）  
  2) `context7 connect chatgpt`（ChatGPT 側の連携を承認）  
  3) 組織/ワークスペースを選択（必要に応じて）

- プロジェクトフォルダの “監視” を有効化  
  例: `context7.yaml` をプロジェクト直下に用意し、監視対象を定義。
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
  適用:
  ```bash
  context7 watch --config ./context7.yaml
  ```

- ChatGPT 側の「Connected sources」確認  
  ChatGPT の設定または会話画面の情報パネルに、`Context7 (my-next-app)` のようなソースが表示され、検索時に参照元として出てくれば接続完了です。

---

## 7. ドキュメント同期の仕組み（Next.js 向け）

- ウォッチャー（ファイル更新検知）  
  `context7 watch` は変更を自動検知し、インデックスを更新します。MCP `server-filesystem` は参照時に最新ファイルを読み出します。

- path mapping の意味  
  MCP の `--root` は「AI が参照できる安全なルート範囲」を定義します。Context7 は `watch.path` と「Connected source」の対応付けで検索可能範囲を決めます。

- Next.js プロジェクトで設定すべきパス例
  - 必須候補:
    - `docs/`
    - `prisma/schema.prisma`
    - `app/api/**`
    - `domain/**`（DTO/UseCase/Service などの自作レイヤ）
    - `README.md`、設計資料
  - 除外推奨:
    - `node_modules/`, `.next/`, `.git/`, `public/build/` など巨大・自動生成物

---

## 8. ChatGPT 側でドキュメントを参照させてコーディングする例（Next.js）

- プロンプト例
  - 「このプロジェクトの API 仕様（`docs/api.yaml`）に沿って `app/api/users/route.ts` の POST を実装して。必要なら `prisma/schema.prisma` を参照し、`User` モデルの制約を満たすバリデーションを入れて。」
  - 「`prisma/schema.prisma` を読んで TypeScript の DTO と Zod スキーマを `domain/` に生成して。既存の命名規則があれば合わせて。」
  - 「`app/api/**` と `docs/` の整合性をチェックして、未実装エンドポイントとレスポンス差分を一覧化して。」

- 参照ログの見方  
  MCP/Context7 対応クライアントでは、メッセージに「参照したドキュメント（Connected sources / MCP resources）」が明示されます。どのファイルが読まれたかを確認し、誤参照ならパスを指定し直します。

---

# 実践編（具体例）

## 9. Next.js / App Router プロジェクトでの活用

- 読ませるべき docs
  - `prisma/schema.prisma`
  - `app/api/**`
  - `domain/**`
  - `README.md`、設計資料

- 例: Prisma スキーマ
  ```prisma
  // prisma/schema.prisma
  model User {
    id        String   @id @default(cuid())
    email     String   @unique
    name      String?
    createdAt DateTime @default(now())
  }
  ```

- API ハンドラ雛形（`app/api/users/route.ts`）
  ```ts
  import { NextResponse } from 'next/server'
  import { prisma } from '@/lib/prisma' // PrismaClient をエクスポートしておく

  export async function GET() {
    const users = await prisma.user.findMany()
    return NextResponse.json({ users })
  }

  export async function POST(req: Request) {
    const { email, name } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const user = await prisma.user.create({ data: { email, name } })
    return NextResponse.json(user, { status: 201 })
  }
  ```

- 型生成・Zod  
  ChatGPT に `schema.prisma` を参照させ、`domain/user.ts` に DTO や Zod スキーマを自動生成させると、API/DB 整合性が上がります。

- テストコード（Vitest 例）
  ```ts
  import { describe, it, expect } from 'vitest'
  import { createUser } from '@/domain/user' // 生成したユースケース関数を想定

  describe('user domain', () => {
    it('creates user DTO', () => {
      const dto = createUser({ email: 'a@example.com', name: null })
      expect(dto.email).toBe('a@example.com')
    })
  })
  ```

- RSC の依存関係チェック  
  `app/` 直下のサーバー/クライアント境界（`'use server'`/`'use client'`）を参照させ、誤った跨ぎを指摘させます。

---

## 10. プロジェクト全体の整合性チェック

- 例プロンプト  
  - 「`docs/` と `app/api/**` の整合性をチェックし、仕様と異なるレスポンス・未実装エンドポイントを列挙して。」  
  - 「`schema.prisma` と `domain/` の型不一致を検出して、修正パッチを提案して。」

- 大規模リファクタでの強さ  
  MCP・Context7 の併用で、依存関係（モジュール/型/ルーティング）を横断的に把握・照合し、破壊的変更の影響範囲を正確に洗い出せます。

---

## 11. テストコード生成への応用（Next.js）

- Playwright E2E（API 例）
  ```ts
  import { test, expect } from '@playwright/test'

  test('create user via API', async ({ request }) => {
    const res = await request.post('/api/users', { data: { email: 'a@example.com' } })
    expect(res.status()).toBe(201)
    const json = await res.json()
    expect(json.email).toBe('a@example.com')
  })
  ```

- Vitest（ユニット/ドメイン）  
  ドメイン層の関数を `domain/**` と `schema.prisma` に基づいて自動生成・補完させると、前提条件や例外系の網羅性が向上。

- 「ドキュメント参照 + コード参照」による高精度な自動生成  
  仕様・スキーマ・既存コードを合わせて参照させることで、モック条件や境界値、認可・バリデーションの観点が抜けにくくなります。

---

## 12. ハマりポイントと対処

- JSON-RPC エラー  
  - `command` の解決失敗 → `npx` 実行可否、`PATH`、プロキシ環境を確認  
  - `args` の相対パス → `cwd` 不一致 → `cwd: "${workspaceFolder}"` を指定

- ポート競合  
  - ソケット型サーバーならポート変更、または `transport: "stdio"` に切替

- watcher の設定漏れ（Context7）  
  - `context7.yaml` の `glob`/`exclude` を見直し  
  - 監視開始コマンドの再起動

- サーバー再起動しないと更新が拾われない  
  - MCP `server-filesystem` は都度読み取り（通常再起動不要）。独自サーバーはホットリロード（`nodemon` 等）を併用。

- VS Code ワークスペース設定の影響  
  - マルチルート構成では `${workspaceFolder}` の解決先に注意。必要なら絶対パス指定。

- 巨大ファイルを読ませない  
  - MCP の `--root` を最小限に。Context7 の `exclude` を厳格化。  
  - バイナリ・ビルド成果物は徹底除外。

---

## 13. セキュリティ面について

- データフローの基本  
  - MCP は「参照の可視化・最小化・ユーザー承認」を重視していますが、モデルがクラウドの場合、参照されたファイル内容（必要な断片）は最終的にモデルへ送信されます。  
  - Context7 も、原則として必要なスニペットだけを会話へ取り込みますが、ポリシーと設定次第で送信が抑制・制御されます。

- ベストプラクティス  
  - `--root` を必要最小限に限定  
  - `exclude` で秘密情報/鍵/環境変数（`.env`, `next.config.js` 内の秘匿値など）を厳格除外  
  - クライアント側の「アップロード前の明示承認」を有効化  
  - オンプレ/閉域モデルの利用（企業内用途）

- 企業内利用メリット  
  - 「誰が何を参照したか」をログ化しやすく、オンプレ文書でも AI 活用が可能。DLP/監査と併用でコンプライアンス運用が容易。

---

## 14. まとめ（おわりに）

- なぜ品質が上がるのか  
  回答が「あなたのプロジェクトの一次情報」に根ざすため、仕様ズレや古い情報の混入が激減。MCP による安全な参照、Context7 による検索性と追跡可能性が、実務的な精度を底上げします。

- 開発体験はどう変わるか  
  - 仕様書・スキーマを読み込ませたうえでのコード提案  
  - 変更に即応する整合性チェック  
  - ドメイン知識を踏まえたテスト自動化

- 実体験  
  「AI がプロジェクト設計書を理解してくれる安心感」は大きく、レビューやリファクタでの認識齟齬が減りました。仕様の“根拠付き”提案は実装スピードだけでなく、意思決定の質も引き上げます。

- 読者へのメッセージ  
  - AI 開発の“次の標準”を体験してほしい  
  - 「プロジェクトの背景を理解した AI」との開発は本当に快適  
  - まずは小規模プロジェクトから、`server-filesystem` と最小限の `--root` で始めてみてください

---

付録: クイックスタート（Next.js）

1) VS Code に MCP 対応拡張を入れる  
2) `settings.json` に `server-filesystem` を登録（`--root` は `docs`, `prisma`, `app`, `domain` など最小限）  
3) Context7 を導入し、`context7.yaml` で監視・除外を定義 → `context7 watch`  
4) ChatGPT で「Connected sources」を確認  
5) 会話で「このプロジェクトの仕様（`docs/...`）に沿って〜」と明示し、参照ログを逐次確認  
6) `app/api/**` と `schema.prisma` を参照しながら、API/型/テストを自動生成・整合性チェック

この構成を一度作っておけば、新規メンバーのオンボーディングや大規模リファクタでも、AI が最新ドキュメントを踏まえた“その場で役に立つ”相棒になってくれます。
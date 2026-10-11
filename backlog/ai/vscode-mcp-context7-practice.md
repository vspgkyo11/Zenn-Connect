---
title: "【VS Code×MCP×Context7】Next.js と Laravel で AI にドキュメントを参照させながら開発する(実践編)"
emoji: "📘"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["context7"]
published: false
---

## はじめに

AI がローカルドキュメントを理解した状態でコード生成やレビューを行うと、開発効率と品質が大きく向上します。本記事では、実際のプロジェクト（Next.js / Laravel）を例にしながら、Context7 と MCP を使って AI が仕様書・DB スキーマ・ルーティング情報などを参照しながら開発できる環境をどのように使いこなすかを解説します。

前編では環境構築手順を扱いましたが、本記事では「実際にどのように使うか」を具体的なワークフローで紹介します。接続時のエラーへの対処とセキュリティ面の考え方も、前編にまとめています。

## 対象者

* 前編の手順で VS Code × MCP × Context7 の環境を構築済みの人
* Next.js（App Router）または Laravel で開発している人
* AI に仕様書・スキーマを踏まえたコード生成やレビューをさせたい人

## Next.js（App Router）プロジェクトでの活用

Next.js は App Router、Server Components、Prisma のように複数の概念が絡み合うため、AI に正確な情報を与えるほど効果が高まります。

### 読ませるべきドキュメント

次のようなファイルを Context7 に読み込ませると AI が正確に参照できます。

* `prisma/schema.prisma`
* `app/api/**`
* `app/(routes)/` または `domain/**`
* README や API 仕様書

これらは API 設計やデータ構造の理解に不可欠なため、コード提案の品質向上に直結します。

### 利用例（API ハンドラ生成）

AI に依頼すると、次のことを踏まえたハンドラが返ってきます。

* `schema.prisma` から該当モデルのフィールド情報を把握する
* 既存の API 設計に合わせたハンドラを生成する
* `app/api/**` 内のフォルダ構成にあわせて適切なファイルパスを提案する

たとえば次のスキーマがあるとします。

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```

これを参照させて生成した API ハンドラの雛形です。

```ts
// app/api/users/route.ts
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

### 利用例（型生成・Zod）

`schema.prisma` を参照させ、`domain/user.ts` に DTO や Zod スキーマを生成させると、API と DB の整合性が上がります。

### 利用例（RSC の依存関係チェック）

`app/` 直下のサーバー/クライアント境界（`'use server'` / `'use client'`）を参照させ、誤った跨ぎを指摘させます。

## Laravel プロジェクトでの活用

Laravel は Model、Migration、Controller、Request が明確な構造で連動するため、AI にディレクトリ全体を理解させることで一貫性のあるコード提案が可能になります。

### 読ませるべき資料

* `routes/web.php`、`routes/api.php`
* `app/Models/**`
* `app/Http/Controllers/**`
* `app/Http/Requests/**`
* `database/migrations/**`

Laravel の場合、FormRequest のバリデーション仕様や Model のリレーション定義がコード品質の要となるため、AI がこれらを参照できる環境は特に有効です。

### 利用例（FormRequest 生成）

* Migration や Model の構造を読み取る
* 既存の命名規則に沿った FormRequest を生成する
* 設計資料に基づき追加のバリデーションルールを提案する

### 利用例（Seeder / Factory 自動生成）

Migration と Model を参照したうえで、Factory や Seeder を生成させることも可能です。リレーション定義の整合性チェックにも使えます。

## プロジェクト全体の整合性チェック

Context7 により設計書とコードが AI の参照対象になるため、次のような整合性チェックができます。

* 設計書に記載されていない API の検出
* Route に存在してコード側に未実装の処理の発見
* Prisma schema と実コードの型不一致
* Laravel の FormRequest と Controller で扱うパラメータの差異

プロンプトの例です。

* 「`docs/` と `app/api/**` の整合性をチェックし、仕様と異なるレスポンス・未実装エンドポイントを列挙して。」
* 「`schema.prisma` と `domain/` の型不一致を検出して、修正パッチを提案して。」

設計資料とコードのズレに気付けず、後工程で問題化するケースは少なくありません。大規模プロジェクトほど差分確認の負担が大きく、大規模リファクタリング時には依存関係（モジュール・型・ルーティング）を横断的に照合して、破壊的変更の影響範囲を洗い出す用途でも効いてきます。

## テストコード生成への応用

Next.js では Playwright や Vitest、Laravel では Feature / Unit テストを対象とした生成が効果的です。

AI が仕様書や API 設計を把握している状態で生成されるため、テストの前提条件や期待される戻り値といった「テストの根拠」が明確になります。

### Playwright（API の E2E）

```ts
import { test, expect } from '@playwright/test'

test('create user via API', async ({ request }) => {
  const res = await request.post('/api/users', { data: { email: 'a@example.com' } })
  expect(res.status()).toBe(201)
  const json = await res.json()
  expect(json.email).toBe('a@example.com')
})
```

### Vitest（ユニット/ドメイン）

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

### 活用ポイント

* 複雑な API 検証ロジックの自動生成
* 既存のテストコードとの一貫性維持
* Prisma や Model に依存したテストデータの自動構築
* 仕様・スキーマ・既存コードを合わせて参照させることで、モック条件や境界値、認可・バリデーションの観点が抜けにくくなる

## おわりに

AI がローカルドキュメントを参照できるようになると、開発フローが大きく変化します。設計書、Migration、Schema、Route、Controller がすべて AI の文脈に入り、プロジェクト単位で整合性の取れたアドバイスやコード生成が可能になるためです。

私が Next.js と Laravel プロジェクトで実践した中で特に印象的だったのは、「AI がプロジェクト設計の意図を理解してくれている安心感」でした。依存関係や設計思想を踏まえた提案が返ってくるため、レビューの前段階が大きく効率化されます。

まずは小規模なプロジェクトからでも構いません。Context7 と MCP の組み合わせを試してみてください。

---

## 株式会社ONE WEDGE
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/

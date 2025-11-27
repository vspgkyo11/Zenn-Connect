---
title: "【Vercel×Neon】Docker以外のローカルDB構成の選択肢"
emoji: "📝"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["Vercel","Neon","DB","Postgres"]
published: true
---

## はじめに

ローカル開発といえば、Docker でデータベースを立ち上げる構成が一般的です。
しかし、昨今ではサーバーレスDBが急速に普及し、本番だけでなくローカルでもクラウドDBを利用する開発スタイルが広がりつつあります。
この記事では「ローカルでも Neon の DB ブランチを使う」という構成の素晴らしさをご紹介します。

## 対象者

* Next.js / Prisma / Vercel で開発している方
* Docker が重い、設定が大変と感じる方
* サーバーレスDBの活用を検討している方

## 前提

### Vercel とは

https://vercel.com/

Vercel は、フロントエンド向けクラウドホスティングサービスで、Next.js を中心としたモダンな Web アプリを高速にデプロイできるプラットフォームです。

Next.js の開発元（Vercel 社）が運営しているため、
Next.js×Vercel の組み合わせは最適化された唯一無二の環境といえます。

**特徴**

* デプロイが極めて高速
* GitHub と自動連携
* Preview Deployment が自動生成
* Edge Functions・Cron・AI SDK などが豊富
* フロントエンド中心の DX（開発体験）が圧倒的に高い

---

## Neon とは

https://neon.tech/

Neon は、PostgreSQL を完全サーバーレスで使えるクラウドサービスです。

特に「DB ブランチ」が最大の特徴で、prod / preview / dev / local など用途別に分岐できる点が、ローカル開発に持ち込む価値が大きい部分です。「リストア」機能がある点も素晴らしいと思います。

**特徴**

* サーバーレス PostgreSQL
* ストレージとコンピュートが分離されており高速
* ブランチ機能（Git のように DB のブランチが作れる）
* Postgres 拡張（pgvector など）対応
* Vercel / Prisma と非常に相性が良い
* 無料枠が広く、個人開発〜小規模プロダクトにも向く
* リストア機能あり

## Neon DB のブランチがローカル開発に向いている理由

今のローカル環境が重かったり、Docker のセットアップが面倒だと感じている方にとっては、特に役に立つ内容です。

### 本番と完全同一のDB環境をすぐ作れる

Neon には Git のような「DBブランチ機能」があり、ボタン一つで次のような環境を用意できます。

* prod
* preview
* dev-userA
* dev-userB
* local
* feature-xxx
* test
  など

この構成により、ローカルでも以下の環境差をなくせます。
ローカルPCごとの違いが消え、動作保証の精度が一気に上がります。

* Postgres のバージョン差
* pgvector など拡張の差
* Collation の違い
* プール接続の設定

## Docker Postgres と Neon の比較

どちらも良い点があり、向いている用途が違います。
そのため最適解は「どちらを使うか」ではなく「どう使い分けるか」です。

| 項目              | Docker    | Neon               |
| --------------- | --------- | ------------------ |
| 起動速度            | 普通        | 即時                 |
| 本番環境との差         | どうしても差が出る | ほぼゼロ               |
| PC負荷            | 高め        | ほぼゼロ               |
| チーム全員の統一        | 難しい       | ブランチ作ればOK          |
| 拡張(pgvector等)再現 | 手動で設定     | 最初から同一環境           |
| 破壊・ミスのリスク       | ローカルだけで完結 | 誤って prod を触る可能性がある |
| リストア機能      | × | 〇 |

:::message
**ポイント**
Neon には、リストア（復元）機能があります。何かしらの事故が起きても、時間指定で復元できるため安心感が大きく、Docker では得られない自由度と安心感が手に入ります。
:::

## メリット
ローカルを Neon にすることで以下の点も便利になりました

### 1. PC を変えても開発継続できる

MacBook → Windows → デスクトップPC
すべて同じDBブランチに接続できます。

### 2. メンバーごとの環境が独立しやすい

「DB壊した…」が、チーム開発から失くすことができます。

### 3. 本番とまったく同じ挙動を検証できる

Postgres 拡張、内部設定、パフォーマンスも限りなく近い状態で検証できます。
これは Docker では再現できません。

## 注意事項
逆に、ローカルを Neon にすることで以下の注意点には気を付けてください。

### 1. 何度も大量に seed するとネットワーク経由で時間がかかる

大量 seed を行う場合、Docker の方が圧倒的に早いことがあります。

### 2. 間違って prod に migrate しないようにする

Prisma Migrate を使う際は、環境変数に注意する必要があります。


## 結論：ハイブリッド構成が実務的

私のおすすめ構成は次のとおりです。

* 本番・プレビュー環境
  　Neon（prod / preview）

* ローカル開発
  　原則 Neon の dev ブランチ
  　必要に応じて Docker Postgres を併用

以下のように使い分けるだけでも開発体験は大きく変わると思います。

具体例：

* 速度が必要な大量 seed → Docker
* 本番と完全同一環境の再現 → Neon
* メンバーごとの作業分離 → Neon ブランチ
* データを持ち歩きたい → Neon
* ネットのない環境で開発 → Docker


## ローカル環境のNeon接続方法

### Neon ブランチの作り方

```
Neon Dashboard → Branches → Create Branch
```

作成したら、それぞれに接続用の DATABASE_URL が付与されます。


### 例：ローカルの Prisma 設定

これだけでローカルが Neon の dev ブランチとつながります。

prisma.config.ts（Prisma 7）

```
// prisma.config.ts
import { defineConfig } from '@prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL
  }
})
```

```
// .env.local
DATABASE_URL="postgresql://user:pass@ep-xxxx.dev.neon.tech/neondb?sslmode=require"
```


## おわりに

私自身、長らくローカルは Docker で Postgres を立ち上げるのが当たり前でした。しかし、Neon のブランチ運用をローカルに導入したことで、ローカルでもクラウドと同一環境を再現でき、開発の負荷を大幅に減らしてくれました。ぜひ一度 Neon ブランチでローカル開発を試してみてください。この記事が開発環境を整える一つのヒントになれば嬉しいです。

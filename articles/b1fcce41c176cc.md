---
title: "【Laravel】静的ファイル管理方法"
emoji: "🍳"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["frontend","css","js","img"]
published: false
---

## はじめに

Laravel Webアプリケーション開発を進めていて、CSSやJavaScriptといった静的ファイルの置き場所について迷ったことはありませんか？
特に、`public/`ディレクトリに置いてよいファイルや`resources/`ディレクトリに置くべきファイルなど、安全性や保守性の観点から正しい構成を知ることはとても大切です。この記事では、Laravelの静的ファイルの配置に関する方針を紹介します。

## 対象者
* CSSやJSを`public/`に直接置いてしまっているエンジニア
* チーム開発をしている方
* ViteやLaravel Mixのビルドに不安がある方

## Laravel ディレクトリ構成のおさらい

Laravelプロジェクトには以下のような役割があります。

| ディレクトリ       | 役割                                                                   |
| ------------ | -------------------------------------------------------------------- |
| `resources/` | 開発用の素材置き場。SCSSやJSの元データをここに置く（開発者のみが扱う場所）                             |
| `public/`    | コンパイル・バンドルされたCSSやJavaScript、HTMLテンプレートの出力先。Webサーバー経由で公開されるファイルを配置します |
| `storage/`   | 一時的なファイルやログなど                                                        |
| `vendor/`    | Composerパッケージ類                                                       |

## `public/`に様々なファイルを置いていませんか？

* ソースが外部から見える：SCSSやモジュールバンドル（※複数のJSファイルや依存ライブラリを1つにまとめる処理）前のJSなど、本来見せるべきでない中間ファイルが公開されてしまう可能性があります
* セキュリティ上のリスク：環境によっては`public/`配下に置いたファイルが意図せずアクセス可能になる場合があります
* メンテナンス困難：構成が分かりづらくなり、チーム開発時に混乱を招きます

例えば、NPO団体であるOWASP(Open Worldwide Application Security Project)が指摘する「不適切なリソース管理（Insecure Resource Management）」に該当するケースもあり、SCSSやモジュールバンドル前のJSファイルが外部からアクセス可能になると、ソースコードの構造や使用ライブラリが漏れるリスクがあります。

## Viteを使った正しい静的ファイル管理の流れ

安全かつ効率的に静的ファイルを管理する方法として、現在のLaravelで標準となっているViteを使った構成は以下の通りです。

Laravel 9以降ではViteがデフォルトビルドツールになりました。以下の手順が推奨されます。

1. `resources/scss/`, `resources/js/`に素材を配置（例えば、CSSとJavaScriptの役割を明確に分けることで、保守性やチーム開発での可読性が向上します）
2. `vite.config.js`でビルド対象と出力先を指定（通常は`public/build/`）
3. `npm run dev`または`npm run build`でビルド
4. Bladeテンプレートで`@vite(['resources/js/app.js', 'resources/scss/app.scss'])`を使用

### ディレクトリ構成例

```
resources/
├── js/
│   └── app.js
└── scss/
    └── app.scss

public/
└── build/
    ├── assets/
    └── manifest.json
```

### Mixを使っている場合（旧構成）

Laravel 8以前や既存プロジェクトではLaravel Mixが使用されています。基本方針はViteと同じです。

* `resources/`に元データを置く
* `webpack.mix.js`でビルド対象を指定
* `npm run dev/build`で`public/`に出力

### チーム開発での注意点

* `.gitignore`で`public/build/`や`node_modules/`は共有しない
* `resources/`と`vite.config.js`はチーム内で共通管理する
* 開発メンバーにViteの使い方を共有し、手動で`public/`に置く文化をなくす

### よくある疑問

* **Q：画像やフォントはどこに置く？**
  → `resources/assets/` に置いてVite経由でビルドするか、`public/assets/`に直接配置します（公開前提の場合）

* **Q：jQueryやFont Awesomeなど、これまでCDNで読み込んでいたライブラリはどう扱うべき？**
  → npm（Node.jsのパッケージマネージャ）を使って、jQueryやFont Awesomeなどのライブラリをプロジェクトに追加し、Viteでバンドル管理することで依存関係の明示性とパフォーマンスが向上します

## 【Tips】`resources/`と`public/`の違いを料理にたとえると？🍳

フロントエンドについて上司に質問していると、こんなことを教わりました。

> 「Laravelで静的ファイルの置き場所に迷ったら、resourcesは台所、publicはお皿に盛り付けた料理だと思うとイメージしやすい!」

どういうことかというと、resources（台所）ではSCSSやJSを丁寧に調理し、ViteやMixという手段でビルドという加熱調理を行います。そしてpublic（テーブル）には、食べられる状態＝ユーザーに届けるファイルだけを並べます。

この手順を守ることで、プロジェクトは衛生的で、安全で、誰が見ても美しい構成になります。

## おわりに

私自身、Laravelに慣れない頃は、publicに直接CSSを置いて動かない、謎のJSエラーが出る…そんな経験に悩まされました。しかし、静的ファイルの整理整頓を心がけて裏方と表舞台をきちんと分ける意識を持つことで、バックエンドとフロントエンドの紐付けが一気に楽になりました。

この記事では、Laravelの静的ファイル、Viteのビルド手順、Laravel Mixとの違い、resourcesディレクトリとpublicディレクトリの使い分けについても整理しています。誤解されがちな配置ルールを見直し、安全で効率的な構成を意識してみてください。

本記事が静的ファイルの管理方法の参考になれば幸いです。
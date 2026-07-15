---
title: "レンタルサーバーの MySQL は設定が緩い：MySQL 8.0 移行で 0000-00-00 問題が起きやすい理由"
emoji: "⚠️"
type: "tech"
topics: ["MySQL", "WordPress", "レンタルサーバー", "データベース"]
published: false
---

# レンタルサーバーの MySQL は設定が緩い：MySQL 8.0 移行で 0000-00-00 問題が起きやすい理由

## はじめに

さくらインターネットの共用サーバーで WordPress を MySQL 5.7 から 8.0 へアップグレードしました。その記録は「[WordPress + MySQL 5.7 → 8.0 移行実録](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)」にまとめています。

さくらの場合、コントロールパネルの「データベースアップグレード機能」から**ボタン一発**でアップグレードできます。操作自体は数分で終わります。

ところが、その「ボタンを押す前」の事前調査で、DBに `0000-00-00 00:00:00` という不正な日付値が**4,300 件以上**蓄積していることがわかりました。これを放置したままアップグレードすると、自動インポート時にレコードが欠落するリスクがあります。

なぜこれほど大量に蓄積していたのか。原因を調べると、**さくらの MySQL 5.7 がデフォルトで `STRICT_TRANS_TABLES`（厳格モード）を無効にしていた**ことがわかりました。

これはさくら固有の話ではなく、レンタルサーバー・共用ホスティング全般に共通しやすい構造的な問題です。この記事では、なぜそういう環境が生まれるのか、移行前にどう確認すればいいかを整理します。

---

## TL;DR

- レンタルサーバーの MySQL 5.7 は `STRICT_TRANS_TABLES` が**無効**になっていることが多い
- その環境では `0000-00-00 00:00:00` という不正な日付値が長年DBに蓄積される
- MySQL 8.0 はデフォルトで厳格モードが有効なため、移行時にこのデータがエラーになる
- **移行前に `SELECT @@sql_mode;` を実行して確認するだけで、このリスクを把握できる**

---

## sql_mode とは何か

MySQL には「どこまで厳しくデータを検証するか」を制御する `sql_mode` という設定があります。

代表的なモードと意味：

| モード | 効果 |
|---|---|
| `STRICT_TRANS_TABLES` | 不正な値の INSERT/UPDATE をエラーにする（無効なら警告のみ） |
| `NO_ZERO_DATE` | `0000-00-00` 形式の日付を不正値として扱う |
| `ONLY_FULL_GROUP_BY` | GROUP BY の曖昧なクエリをエラーにする |

`STRICT_TRANS_TABLES` が**有効**の場合、`0000-00-00 00:00:00` を INSERT しようとするとエラーになります。  
`STRICT_TRANS_TABLES` が**無効**の場合、同じ INSERT が**警告のみで通過**します。

---

## なぜレンタルサーバーは設定が緩いのか

レンタルサーバー（特に共用サーバー）には独特の事情があります。

**1. 古いアプリとの後方互換性を優先する**

共用サーバーには多種多様なアプリが同居しています。`STRICT_TRANS_TABLES` を有効にすると、古いアプリのクエリが急にエラーになりクレームが増えます。サービス提供者としては「緩くしておく」ほうが安全です。

**2. ユーザーが sql_mode を変更できない**

専用サーバーや VPS なら `my.cnf` を直接編集できますが、共用サーバーではサーバー管理者だけが設定を変更できます。ユーザー側で厳格化する手段がありません。

**3. MySQL のデフォルト設定が時代とともに厳格化された**

MySQL 5.6 以前はデフォルトで `sql_mode` がほぼ空（何も制限しない）でした。5.7 でも緩い設定のままにしているサービスが多く、8.0 で初めて厳格なデフォルトになりました。

---

## 実際に何が蓄積されるか

`STRICT_TRANS_TABLES` が無効な環境では、WordPress や一部プラグインが `0000-00-00 00:00:00` を書き込んでも、MySQL が無言で受け入れます。

代表的な発生パターン：

- **WordPress の auto-draft**：新規投稿画面を開くたびに生成される一時保存データ。公開日時が未設定の状態で `post_date_gmt = 0000-00-00 00:00:00` が入る
- **プラグインのログテーブル**：WP All Export など、処理日時を持つテーブルで初期値が `0000-00-00` になるケース
- **SEO プラグインのインデックステーブル**：Yoast SEO の `wp_yoast_indexable` など

これらは MySQL 5.7 環境では「存在するが問題にならないデータ」として何年も蓄積されます。

---

## MySQL 8.0 で何が起きるか

MySQL 8.0 のデフォルト `sql_mode`：

```
ONLY_FULL_GROUP_BY, STRICT_TRANS_TABLES, NO_ZERO_IN_DATE, NO_ZERO_DATE,
ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` と `NO_ZERO_DATE` が**両方**有効になります。

この組み合わせで `0000-00-00 00:00:00` を INSERT しようとすると：

```
ERROR 1525 (HY000): Incorrect DATETIME value: '0000-00-00 00:00:00'
```

ただし実際のアップグレード機能（自動ダンプ → 自動インポート）では、mysqldump 冒頭の `SET SQL_MODE` によりインポート時にこのエラーは発生せず、インポート自体は成功します。`0000-00-00` が問題になるのは phpMyAdmin での直接操作など、WordPress や mysqldump を経由しない文脈です。

---

## 移行前の確認手順

### 1. 現在の sql_mode を確認する

phpMyAdmin の SQL タブ、または SSH で実行：

```sql
SELECT @@sql_mode;
```

結果に `STRICT_TRANS_TABLES` が**含まれていなければ**、このリスクがあります。

今回の実測値（さくらインターネット）：

| モード | MySQL 5.7（移行前） | MySQL 8.0（移行後） |
|---|---|---|
| `STRICT_TRANS_TABLES` | **なし** | **あり** ← 追加 |
| `NO_AUTO_CREATE_USER` | あり | **なし** ← MySQL 8.0 で廃止 |
| `NO_ZERO_IN_DATE` | あり | あり |
| `NO_ZERO_DATE` | あり | あり |
| `ERROR_FOR_DIVISION_BY_ZERO` | あり | あり |
| `NO_ENGINE_SUBSTITUTION` | あり | あり |

`STRICT_TRANS_TABLES` が追加されたことが今回の 0000-00-00 問題の根本です。クレンジングなしで移行していたらデータが欠落していたことが事後確認で裏付けられました。

### 2. 0000-00-00 データが何件あるか確認する

DBダンプファイルに対してざっくり確認する場合：

```bash
grep -c "0000-00-00 00:00:00" dump.sql
```

テーブルごとに確認する場合（phpMyAdmin の SQL タブ）：

```sql
SELECT COUNT(*) FROM wp_posts
WHERE post_date         = '0000-00-00 00:00:00'
   OR post_date_gmt     = '0000-00-00 00:00:00'
   OR post_modified     = '0000-00-00 00:00:00'
   OR post_modified_gmt = '0000-00-00 00:00:00';
```

0件であれば問題なし。1件以上あれば移行前にクレンジングが必要です。

---

## 対処：移行前にデータをクレンジングする

`0000-00-00 00:00:00` を MySQL 8.0 が許容する値に書き換えます。

置換先は 2 択です：

| 状況 | 置換先 |
|---|---|
| カラムが `NOT NULL` 制約あり | `1970-01-01 00:00:00`（最古の有効な日付） |
| カラムが `NULL` 許容（DEFAULT NULL） | `NULL` |

```sql
START TRANSACTION;

UPDATE wp_posts
SET post_date         = '1970-01-01 00:00:00',
    post_date_gmt     = '1970-01-01 00:00:00',
    post_modified     = '1970-01-01 00:00:00',
    post_modified_gmt = '1970-01-01 00:00:00'
WHERE post_date         = '0000-00-00 00:00:00'
   OR post_date_gmt     = '0000-00-00 00:00:00'
   OR post_modified     = '0000-00-00 00:00:00'
   OR post_modified_gmt = '0000-00-00 00:00:00';

COMMIT;
```

実行後、カウントが 0 になっていることを確認してからアップグレードします。

> クレンジング後は必ずバックアップを取り直すこと。クレンジング前のバックアップは `0000-00-00` を含むため、MySQL 8.0 への再インポートが必要になったときに失敗します。

---

## 補足：WordPress 自体は実は壊れない

「MySQL 8.0 にしたら `0000-00-00` のせいで新規投稿が作れなくなるのでは？」と思うかもしれません。実際に WordPress コアのソース（`wp-includes/post.php`）を確認すると、draft・auto-draft・pending のステータスで保存するとき **意図的に `post_date_gmt = '0000-00-00 00:00:00'` を書き込む**コードが今も存在します。

しかし WordPress は `wp-includes/class-wpdb.php`（バージョン 3.9.0 から）で、MySQL に接続するたびに以下を**セッション単位で強制的に外しています**：

```php
// WordPress が「非互換」として除去する sql_mode
protected $incompatible_modes = array(
    'NO_ZERO_DATE',
    'ONLY_FULL_GROUP_BY',
    'STRICT_TRANS_TABLES',
    'STRICT_ALL_TABLES',
    'TRADITIONAL',
    'ANSI',
);
```

実際に WordPress の DB 接続中の sql_mode を確認すると：

```
NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` も `NO_ZERO_DATE` も消えています。つまり WordPress 経由での `0000-00-00` INSERT は MySQL 8.0 でも**エラーにならない**のです。

アクセス経路ごとの挙動をまとめると：

| アクセス経路 | sql_mode | 0000-00-00 の書き込み |
|---|---|---|
| WordPress（wpdb） | 接続時に STRICT を自動で除去 | **成功** |
| phpMyAdmin | サーバーの設定をそのまま使用 | **ERROR 1292** |
| mysqldump のインポート | dump 冒頭の `SET SQL_MODE` で除去 | **成功** |

WordPress の通常運用は「翌日から壊れる」ことはありません。

---

## ではなぜクレンジングが必要なのか

WordPress の動作は守られています。では `0000-00-00` を放置したまま MySQL 8.0 に移行してもいいのか。それでも問題になる場面があります。

**phpMyAdmin から直接操作するとき**
`WHERE post_date_gmt = '0000-00-00 00:00:00'` のような比較クエリが `ERROR 1525` になります。phpMyAdmin での通常の閲覧は問題ありませんが、SQL タブで直接操作しようとするとハマります。

**バックアップを MySQL 8.0 環境に再インポートするとき**
クレンジング前のバックアップには INSERT データに `0000-00-00` が含まれています。phpMyAdmin のエクスポートには `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"` が入るため実際はインポートできてしまいますが、ツールによっては失敗します。また「インポートできた」としても、DB の中に不正値が残り続ける状態は変わりません。

**今後の移行・メンテナンスの健全性**
DB に `0000-00-00` が残っている限り、将来どこかで予期しないエラーに遭遇するリスクがあります。クレンジングは「WordPress の動作保護」ではなく、**DB 自体を MySQL 8.0 の標準に準拠させる**ための作業です。

---

## まとめ

| 確認ポイント | コマンド |
|---|---|
| sql_mode の確認 | `SELECT @@sql_mode;` |
| 0000-00-00 の件数確認 | `grep -c "0000-00-00" dump.sql` |
| クレンジング | トランザクション内で UPDATE → 件数 0 を確認 → COMMIT |
| クレンジング後バックアップ | `mysqldump` を再実行 |

`SELECT @@sql_mode;` の一行だけで「このリスクがあるかどうか」は即座にわかります。MySQL 8.0 への移行を検討しているなら、まずこれを実行してみてください。

WordPress は賢く STRICT モードを回避するように設計されています。それでもクレンジングをするのは、**DB そのものを正しい状態にしておくため**です。

---

**メイン記事**：[WordPress + MySQL 5.7 → 8.0 移行実録（さくらインターネット共用サーバー）](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)

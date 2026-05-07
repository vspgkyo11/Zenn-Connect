---
title: "WordPress + MySQL 5.7 → 8.0 移行実録（さくらインターネット共用サーバー）"
emoji: "🔧"
type: "tech"
topics: ["WordPress", "MySQL", "さくらインターネット", "データベース"]
published: false
---

# WordPress + MySQL 5.7 → 8.0 移行実録（さくらインターネット共用サーバー）

## はじめに：ボタン一発の裏側

さくらインターネットの共用レンタルサーバー上で動作する WordPress サイトを、MySQL 5.7 から 8.0 へアップグレードしました。

さくらの場合、コントロールパネルの「データベースアップグレード機能」を使えば、ダンプ・インポート・接続先切り替えまで自動で完了します。操作はボタンを一回押すだけです。

しかし、**MySQL 5.7 と 8.0 ではデータベースの仕様が変わっているため、「押す前」の準備が成否を分けます。**

この記事では、実際に行った事前調査・Docker 検証・データクレンジング・本番当日の手順を、なぜそれが必要だったかという理由も含めてまとめます。

### 環境

| 項目 | 内容 |
|---|---|
| サーバー | さくらインターネット 共用サーバー（FreeBSD） |
| WordPress | 6.9.4 |
| PHP | 8.3.30 |
| MySQL（移行前） | 5.7 |
| MySQL（移行後） | 8.0.39 |
| Apache | 2.4.65 |

---

## 1. まず何が問題になりうるか調べた

MySQL 5.7 → 8.0 での主な仕様変更は広く知られています。

| 変更点 | 概要 |
|---|---|
| 認証プラグインの変更 | デフォルトが `caching_sha2_password` に変わる（旧 PHP/WP と非互換） |
| `sql_mode` の厳格化 | `STRICT_TRANS_TABLES` や `ONLY_FULL_GROUP_BY` がデフォルト有効に |
| 無効な日付値の扱い | `0000-00-00 00:00:00` が厳格モードでエラーになる |
| 予約語の追加 | `RANK`, `GROUPS` 等が新たに予約語になり、カラム名と衝突する可能性 |

このうち、**認証プラグアインと予約語はコードを見た限りほぼリスクなし**と判断しました。さくらの場合は `mysql_native_password` を引き続き使う設定で接続できることも確認済みです。

問題になりそうだと気づいたのが **`sql_mode` の変化と、それに伴う無効な日付値（`0000-00-00`）の扱い** でした。

---

## 2. 本番 DB ダンプを解析したら 5,000 件超の異常データが見つかった

本番 DB のバックアップダンプを静的解析したところ、`0000-00-00 00:00:00` を含むレコードが **数千件**検出されました。

主な発生テーブルは `wp_posts`（投稿テーブル）で、そのほとんどが `auto-draft`（WordPressが自動生成する下書き）でした。

```
wp_posts:
  auto-draft（自動保存）: 大多数（数千件）
  draft（下書き）       :  少数（数十件）
wp_pmxe_exports          :  少数
合計                      : 数千件
```

なぜこのようなデータが存在するのか、調べてわかりました。

---

## 3. 根本原因：さくら本番の `sql_mode` が緩かった

本番 MySQL 5.7 で `SELECT @@sql_mode;` を実行すると：

```
NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` が**入っていませんでした。**

MySQL の挙動はこうなっています：

- `NO_ZERO_DATE` だけ有効 → `0000-00-00` を INSERT しても **警告のみで通過する**
- `NO_ZERO_DATE` + `STRICT_TRANS_TABLES` の両方が有効 → `0000-00-00` を INSERT すると **エラーになる**

さくら本番の MySQL 5.7 は `STRICT_TRANS_TABLES` が無効だったため、WordPress や一部プラグインが長年にわたって `0000-00-00 00:00:00` を書き込み続けていたのです。

一方、MySQL 8.0 のデフォルト `sql_mode` は：

```
ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,
ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` が有効になります。これにより、`0000-00-00 00:00:00` を含むデータを **インポートまたは更新しようとするとエラーになります。**

特に、さくらのアップグレード機能は「自動ダンプ → MySQL 8.0 へ自動インポート」で完結するため、**クレンジングせずにアップグレードボタンを押すと、インポート時にレコードが欠落するリスクがあります。**

---

## 4. Docker で並列検証環境を作って安全に確認した

本番で試すわけにはいかないので、Docker で MySQL 5.7 と 8.0 を並列に立てた検証環境を作りました。

```
docker-compose.yml          → MySQL 5.7 + WordPress (port 8080)
docker-compose.mysql8.yml  → MySQL 8.0 + WordPress (port 8081)
```

本番 DB ダンプを両環境にインポートして比較することで、MySQL バージョンアップによる動作差異を安全に確認できます。

MySQL 8.0 では `MYSQL_AUTHENTICATION_POLICY: mysql_native_password` の設定が必要です（MySQL 8 のデフォルト認証方式 `caching_sha2_password` は旧 PHP 版や WordPress と互換性がないため）。

```yaml
# docker-compose.mysql8.yml（抜粋）
environment:
  MYSQL_AUTHENTICATION_POLICY: mysql_native_password
```

検証結果のサマリーです：

| 確認項目 | MySQL 5.7 | MySQL 8.0 | 差異 |
|---|---|---|---|
| トップページ表示 | ✅ 200 OK | ✅ 200 OK | なし |
| wp-admin 表示 | ✅ 200 OK | ✅ 200 OK | なし |
| GROUP BY クエリ | ✅ 正常 | ✅ 正常 | なし |
| PHP Fatal Error | なし | なし | なし |

公開コンテンツへの影響はゼロ。問題は `0000-00-00` データのみに限定されていることが確認できました。

---

## 5. クレンジング SQL の設計と事前検証

### 方針の選択

対処方法は 2 つ考えました：

- **方針A（クレンジング）**：アップグレード前に `0000-00-00` を正常な日付値に書き換える
- **方針B（`sql_mode` 緩和）**：アップグレード後の MySQL 8.0 側で `STRICT_TRANS_TABLES` を外す

さくら側の `sql_mode` をユーザーが自由に変更できるかどうかは不明だったため、**確実に制御できる方針A（クレンジング）** を選択し、方針Bはアップグレード後に `SELECT @@sql_mode;` で結果を確認することにしました。

### 影響テーブルと置換ルール

調査の結果、対象テーブルは以下の 3 つでした。

| テーブル | カラム | 置換先 |
|---|---|---|
| `wp_posts` | `post_date`, `post_date_gmt`, `post_modified`, `post_modified_gmt` | `1970-01-01 00:00:00` |
| `wp_pmxe_exports` | `canceled_on`, `settings_update_on` | `1970-01-01 00:00:00`（NOT NULL 制約のため） |
| `wp_yoast_indexable` | `created_at`, `object_last_modified`, `object_published_at` | `NULL`（DEFAULT NULL のため） |

`wp_pmxe_exports.canceled_on` は `NOT NULL` 制約があるため `NULL` にできません。`NULL` に置換しようとするとエラーになるので、`1970-01-01 00:00:00` を使います。

### Docker でクレンジング SQL を事前検証

本番で実行する前に、Docker 検証環境でクレンジング SQL を走らせて、件数が 0 になることと wp_posts のレコード総数が変わらないことを確認しました。

| 確認項目 | 期待値 | 結果 |
|---|---|---|
| `wp_posts` 0000-00-00（クレンジング後） | 0件 | 0件 ✅ |
| `wp_pmxe_exports` 0000-00-00（クレンジング後） | 0件 | 0件 ✅ |
| MySQL 5.7 wp_posts 件数 | N件 | N件 ✅ |
| MySQL 8.0 wp_posts 件数（インポート後） | N件 | N件 ✅ |

**判定：合格。**本番クレンジング → アップグレードは安全と確認できました。

---

## 6. 本番当日：想定外の追加問題が判明した

当日、本番 DB で事前カウントクエリを実行したところ、**事前調査で見落としていたカラム** が見つかりました。

事前調査段階のクレンジング SQL には `WHERE post_date = '0000-00-00' OR post_modified = '0000-00-00'` という条件しかなく、**`post_date_gmt` と `post_modified_gmt` の `_gmt` カラムを見落としていました。**

また `wp_yoast_indexable` テーブルの影響も新たに判明しました。

実測値：

| テーブル | 件数 |
|---|---|
| `wp_posts`（4カラム合計、ユニーク） | 数千件 |
| `wp_pmxe_exports`（settings_update_on） | 少数 |
| `wp_yoast_indexable`（3カラム） | 数十件 |
| **合計** | **数千件超** |

ちなみに事前調査時より件数が減っていたのは、その間に WordPress が auto-draft を正常な日付で再生成・上書きしたためです。データは生き物で変化します。

> **教訓**：事前調査のクエリは本番 DB に対して必ず直前に再実行し、実測値を記録してから進める。調査時の数字はあくまで「その時点のスナップショット」です。

---

## 7. 本番当日の手順

### STEP 1: 手動バックアップ（アップグレード前）

さくらの自動バックアップとは別に、手動でも取得します。

```bash
# さくら SSH で実行
mysqldump -u <DBユーザー名> -p <DB名> > backup_before_upgrade.sql
```

または phpMyAdmin の「エクスポート」タブからでも可。**取り返しのつかない作業前のバックアップは二重に取る**、が鉄則です。

### STEP 2: データクレンジング（phpMyAdmin の SQL タブで実行）

まず実行前に現状をカウントで記録し、次にトランザクション内でクレンジングを実行します。

```sql
-- 実行前カウント（全カラム網羅）
SELECT
  SUM(CASE WHEN post_date = '0000-00-00 00:00:00' THEN 1 ELSE 0 END) AS post_date_zero,
  SUM(CASE WHEN post_date_gmt = '0000-00-00 00:00:00' THEN 1 ELSE 0 END) AS post_date_gmt_zero,
  SUM(CASE WHEN post_modified = '0000-00-00 00:00:00' THEN 1 ELSE 0 END) AS post_modified_zero,
  SUM(CASE WHEN post_modified_gmt = '0000-00-00 00:00:00' THEN 1 ELSE 0 END) AS post_modified_gmt_zero
FROM wp_posts;
```

```sql
START TRANSACTION;

-- wp_posts: 全4カラムを網羅する WHERE 句
UPDATE wp_posts
SET post_date         = '1970-01-01 00:00:00',
    post_date_gmt     = '1970-01-01 00:00:00',
    post_modified     = '1970-01-01 00:00:00',
    post_modified_gmt = '1970-01-01 00:00:00'
WHERE post_date         = '0000-00-00 00:00:00'
   OR post_date_gmt     = '0000-00-00 00:00:00'
   OR post_modified     = '0000-00-00 00:00:00'
   OR post_modified_gmt = '0000-00-00 00:00:00';

-- wp_pmxe_exports: NOT NULL 制約のため 1970-01-01 を使う
UPDATE wp_pmxe_exports
SET canceled_on        = '1970-01-01 00:00:00'
WHERE canceled_on        = '0000-00-00 00:00:00';

UPDATE wp_pmxe_exports
SET settings_update_on = '1970-01-01 00:00:00'
WHERE settings_update_on = '0000-00-00 00:00:00';

-- wp_yoast_indexable: DEFAULT NULL のため NULL に置換
UPDATE wp_yoast_indexable
SET created_at           = NULL
WHERE created_at           = '0000-00-00 00:00:00';

UPDATE wp_yoast_indexable
SET object_last_modified = NULL
WHERE object_last_modified = '0000-00-00 00:00:00';

UPDATE wp_yoast_indexable
SET object_published_at  = NULL
WHERE object_published_at  = '0000-00-00 00:00:00';

COMMIT;
```

実行後、カウントクエリを再実行してすべて 0 件になっていることを確認します。

クレンジング後のバックアップも再取得します（クレンジング前のバックアップは `0000-00-00` を含むため、MySQL 8.0 への再インポートが必要になったときに失敗します）。

```bash
mysqldump -u <DBユーザー名> -p <DB名> > backup_after_cleansing.sql

# INSERT データ部分に 0000-00-00 が残っていないことを確認
awk '/^INSERT INTO/{p=1} p' backup_after_cleansing.sql | grep -c "0000-00-00 00:00:00"
# → 0 になることを確認
```

### STEP 3: アップグレード実行（ボタンを押す）

1. さくらコントロールパネルにログイン
2. **「Webサイト/データ」→「データベース」**
3. 対象 DB の **「データベースアップグレード機能」→「アップグレード設定」** をクリック
4. 確認画面で内容を確認して実行

所要時間は数分〜15分程度。完了後、**新しいホスト名**（`mysql80.xxxx.sakura.ne.jp`）が表示されるのでメモしておきます。

この時点ではまだ `wp-config.php` が旧 MySQL 5.7 のホスト名を向いているため、サイトは旧 DB を参照し続けます。

### STEP 4: `wp-config.php` の `DB_HOST` を書き換える

FTP またはファイルマネージャーで `wp-config.php` を開き、`DB_HOST` を新ホスト名に変更します。

```php
// 変更前
define( 'DB_HOST', 'mysql57.xxxx.sakura.ne.jp' );

// 変更後
define( 'DB_HOST', 'mysql80.xxxx.sakura.ne.jp' );
```

`DB_NAME` は今回変更なし（さくら公式の案内に従い、名前変更した場合のみ修正）。

### STEP 5: 動作確認

- サイトのトップページが表示されるか
- `wp-admin` にログインできるか
- 「ツール → サイトヘルス → 情報 → データベース」でサーバーバージョンが `8.0.39` になっているか

さくらの MySQL 8.0 での `sql_mode` 実測値：

```
STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` が有効でした。ただし後から判明したことですが、mysqldump 冒頭の `SET SQL_MODE` によりインポート自体はクレンジングなしでも成功します。クレンジングは WordPress の動作保護ではなく、**DB 自体を MySQL 8.0 の仕様に準拠させる**ための作業です（詳細は「[クレンジングは本当に必要だったのか](https://zenn.dev/vspgkyo11/articles/cleansing-was-it-necessary)」）。

---

## 8. まとめ：「ボタン一発」の価値は事前準備で決まる

今回のアップグレードで実感したのは、**本番当日の作業時間はわずか 1 時間程度**で、そのほとんどがバックアップとクレンジングだったということです。「ボタンを押す」という本番操作自体は 5 分で終わりました。

しかし、その前に以下のことを丁寧にやっていたから安心して押せました：

1. **ダンプ解析で異常データの規模と原因を特定した**
2. **sql_mode の変化がどんな影響を与えるか論理的に理解した**
3. **Docker 検証で「クレンジング後に件数欠落が起きない」ことを事前確認した**
4. **クレンジング SQL を Docker で試してから本番に適用した**
5. **本番実測で調査時との差異を発見し、SQL を修正してから進めた**

レンタルサーバーのワンクリックアップグレードは便利ですが、その裏では「データがそのまま移せるか」を事前に確認しておく必要があります。特に MySQL 5.7 から 8.0 への移行では **`0000-00-00 00:00:00` の存在確認とクレンジング**がほぼ必須の工程です。

### チェックリスト（再現する人向け）

- [ ] 本番 DB ダンプに `0000-00-00 00:00:00` が何件あるか確認（`grep -c "0000-00-00" dump.sql`）
- [ ] 本番 MySQL 5.7 の `sql_mode` を `SELECT @@sql_mode;` で実測する
- [ ] 影響テーブルを特定し、各カラムの `NOT NULL` 制約を確認する（NULL か 1970-01-01 か選択が変わる）
- [ ] クレンジング SQL を検証環境で先に実行し、件数欠落がないことを確認する
- [ ] 本番当日も必ずカウントクエリで実測してから進める（事前調査の数字は変化する）
- [ ] クレンジング後のバックアップを別途取り直す
- [ ] アップグレード後に `SELECT @@sql_mode;` で実際の設定を記録する

---

## 付録：MySQL 5.7 → 8.0 の主な変更点早見表

| 変更点 | リスクレベル | 対処 |
|---|---|---|
| 認証プラグイン（`caching_sha2_password`） | 中 | `mysql_native_password` を明示指定（Docker なら compose オプション） |
| `STRICT_TRANS_TABLES` 有効化 | **高** | 移行前に `0000-00-00` データをクレンジング |
| `ONLY_FULL_GROUP_BY` 有効化 | 中 | 古いプラグインの GROUP BY クエリがエラーになる場合あり |
| 予約語の追加（`RANK`, `GROUPS` 等） | 低 | カラム名・テーブル名のバッククォート漏れを確認 |
| デフォルト文字コード（`utf8mb4`） | 低 | WordPress は通常独自指定のため影響しにくい |

---

## 関連記事

- [レンタルサーバーの MySQL は設定が緩い：MySQL 8.0 移行で 0000-00-00 問題が起きやすい理由](https://zenn.dev/vspgkyo11/articles/shared-hosting-sqlmode-risk) — なぜさくらの sql_mode が緩かったのか、構造的な背景を解説
- [クレンジングは本当に必要だったのか：WordPress が sql_mode を自分で外していた話](https://zenn.dev/vspgkyo11/articles/cleansing-was-it-necessary) — WordPress が STRICT_TRANS_TABLES を自動で外している事実と、それでもクレンジングした理由

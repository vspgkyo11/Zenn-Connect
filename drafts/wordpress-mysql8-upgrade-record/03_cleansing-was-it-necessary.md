---
title: "クレンジングは本当に必要だったのか：WordPress が sql_mode を自分で外していた話"
emoji: "🔍"
type: "tech"
topics: ["WordPress", "MySQL", "データベース"]
published: false
---

# クレンジングは本当に必要だったのか：WordPress が sql_mode を自分で外していた話

## はじめに

MySQL 8.0 への移行が完了してしばらく後、気になっていたことを確認した。

ネット上の「さくら MySQL 8.0 アップグレード」記事の多くは、「コントロールパネルからボタンを押したら完了した」で終わっている。事前のデータクレンジングには言及がない。それでも問題が起きていないのはなぜか。

自分はクレンジングをしてからアップグレードした。もしクレンジングなしでも動いていたなら、あの作業は何だったのか。調べると、**クレンジングをしなくてもアップグレード自体は成功していた**という事実が判明した。

この記事では「なぜ成功していたのか」「では何のためにクレンジングしたのか」を掘り下げる。

移行作業の全体像は「[WordPress + MySQL 5.7 → 8.0 移行実録](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)」を、なぜ `0000-00-00` が大量に蓄積していたかの背景は「[レンタルサーバーの MySQL は設定が緩い](https://zenn.dev/vspgkyo11/articles/shared-hosting-sqlmode-risk)」を参照。

---

## 1. WordPress は接続のたびに STRICT を自分で外している

WordPress コアのソース `wp-includes/class-wpdb.php`（バージョン 3.9.0 から存在）に次のコードがある。

```php
protected $incompatible_modes = array(
    'NO_ZERO_DATE',
    'ONLY_FULL_GROUP_BY',
    'STRICT_TRANS_TABLES',
    'STRICT_ALL_TABLES',
    'TRADITIONAL',
    'ANSI',
);
```

WordPress は DB 接続時に `SET SESSION sql_mode = ...` を発行し、このリストに含まれるモードをすべてセッションから削除する。

MySQL 8.0 のデフォルトは `STRICT_TRANS_TABLES` が有効だが、WordPress 経由で接続した瞬間にそれが消える。実際に WordPress の DB 接続中に `sql_mode` を確認すると：

```
NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` も `NO_ZERO_DATE` も消えている。その状態で `0000-00-00 00:00:00` を INSERT しても、MySQL 8.0 はエラーにしない。

WordPress が `wp-includes/post.php` で `post_date_gmt = '0000-00-00 00:00:00'` を**意図的に書き込む**コードが今も存在するのは、この自衛機構があるからだ。MySQL 8.0 でも、WordPress の通常運用は翌日から壊れない。

---

## 2. mysqldump も STRICT を回避する

さくらの自動アップグレード機能は内部的に mysqldump でダンプを取り、MySQL 8.0 に再インポートする。

phpMyAdmin でエクスポートした `.sql` ファイルの冒頭には、必ずこのような行が入っている：

```sql
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
```

この `SET SQL_MODE` により、インポート中の sql_mode が上書きされる。結果として、`0000-00-00` を含む INSERT 文がそのままインポートされてもエラーにならない。「ボタン一発」派のアップグレードが成功していた理由はここにある。

---

## 3. アクセス経路ごとの整理

| アクセス経路 | sql_mode | `0000-00-00` の扱い |
|---|---|---|
| WordPress（wpdb 経由） | 接続時に STRICT / NO_ZERO_DATE を除去 | INSERT/UPDATE 成功 |
| phpMyAdmin | サーバー設定をそのまま使用 | SELECT でも ERROR 1525 |
| mysqldump → インポート | dump 冒頭の `SET SQL_MODE` で除去 | インポート成功 |
| mysql コマンド直接 / 一部ツール | サーバー設定をそのまま使用 | INSERT でエラーになる可能性 |

WordPress 経由の通常運用は守られている。問題になるのは「WordPress を通らない」文脈だけだ。

---

## 4. では、クレンジングは何のためだったのか

「WordPress も守っている、ダンプも守っている、なら調査もクレンジングも無駄だったのか」というと、そうではない。

**phpMyAdmin で直接 SQL を叩くとき**

phpMyAdmin の SQL タブから直接クエリを実行する場合、sql_mode はサーバー設定がそのまま使われる。MySQL 8.0 環境で次のクエリを実行すると：

```sql
SELECT * FROM wp_posts WHERE post_date_gmt = '0000-00-00 00:00:00';
```

```
ERROR 1525 (HY000): Incorrect DATETIME value: '0000-00-00 00:00:00'
```

`0000-00-00` を比較値に使うだけでエラーになる。DB に不正値が残っている限り、phpMyAdmin での直接操作は地雷だらけになる。

**サードパーティツールでバックアップ・リストアするとき**

WordPress とダンプが用意している「回避」は、それぞれの文脈でしか機能しない。別のバックアッププラグインや直接の `mysql` コマンドでインポートした場合、STRICT が有効なまま `0000-00-00` を挿入しようとしてエラーになる可能性がある。問題に気づくのは往々にして「いちばん困るタイミング」だ。

**DB 自体が MySQL 8.0 の標準に準拠していない状態が続く**

WordPress が回避してくれていても、DB の中に `0000-00-00` が残り続けることは変わらない。将来の移行、監査、バグ調査のどこかで予期しない問題として浮上するリスクが残る。

> **結論**：クレンジングは「WordPress を守るため」ではなかった。WordPress は自分で守る仕組みを持っている。クレンジングとは、WordPress に依存せず、**DB 自体を MySQL 8.0 の仕様に準拠させる作業**だった。

---

## 5. 「なぜ成功するのか」を理解することの意義

「ボタン一発で大丈夫」は正しい。ただしその理由は「MySQL 8.0 が緩い」からではなく、**WordPress が賢く立ち回っているから**だ。

その構造を理解した上でクレンジングするのと、何も知らずにボタンを押すのでは、同じ結果でも意味が違う。phpMyAdmin での直接操作やサードパーティツール導入のときに、どこでエラーが出てどこでは出ないかを判断できる。

---

## まとめ

| 問い | 答え |
|---|---|
| クレンジングしなくても WordPress は動いたか？ | **動いた**（WordPress が STRICT を外しているため） |
| ダンプのインポートは成功したか？ | **成功した**（dump 冒頭の `SET SQL_MODE` が機能するため） |
| ではクレンジングは不要だったか？ | **DB の健全性のためには必要**（phpMyAdmin 操作、外部ツール、将来の移行に影響する） |
| 事前調査に意味はあったか？ | **あった**。「なぜ壊れないのか」の仕組みがわかったこと自体が成果 |

---

**メイン記事**：[WordPress + MySQL 5.7 → 8.0 移行実録（さくらインターネット共用サーバー）](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)

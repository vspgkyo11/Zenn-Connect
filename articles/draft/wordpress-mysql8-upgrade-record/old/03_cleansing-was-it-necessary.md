---
title: "クレンジングは本当に必要だったのか：WordPress が sql_mode を自分で外していた話"
emoji: "🔍"
type: "tech"
topics: ["WordPress", "MySQL", "データベース"]
published: false
---

# クレンジングは本当に必要だったのか：WordPress が sql_mode を自分で外していた話

## はじめに

さくらインターネットの共用サーバーで WordPress を MySQL 5.7 → 8.0 にアップグレードしました。その記録は「[WordPress + MySQL 5.7 → 8.0 移行実録](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)」にまとめています。

移行前、DB ダンプを解析して `0000-00-00 00:00:00` という無効な日付値が **5,656 件**あることを発見しました。MySQL 8.0 の厳格モード（`STRICT_TRANS_TABLES`）でこれをインポートするとエラーになる、という判断でクレンジングを実施。クレンジング後にアップグレードし、問題なく完了しました。

ところが後から調べると、**クレンジングをしなくてもアップグレードは成功していた**ということがわかりました。

この記事では「なぜ成功していたのか」「では何のためにクレンジングしたのか」を掘り下げます。

---

## TL;DR

- WordPress は MySQL に接続するたびに、セッション単位で `STRICT_TRANS_TABLES` を**自動的に外している**
- phpMyAdmin のダンプファイルにも `SET SQL_MODE` があり、インポート時に STRICT が無効化される
- そのため「ボタン一発」でも WordPress は壊れない
- クレンジングは WordPress の動作保護ではなく、**DB 自体を正しい状態にするための作業**

---

## 「ボタン一発」組が壊れない理由

ネット上の「さくら MySQL 8.0 アップグレード」記事の多くは、「コントロールパネルからボタンを押したら完了した」で終わっています。事前のデータクレンジングには言及がありません。それでも問題が起きていないのはなぜか。

WordPress 自身が、接続のたびに sql_mode を調整しているからです。

`wp-includes/class-wpdb.php`（WordPress 3.9.0 から存在）に次のコードがあります：

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

WordPress は DB 接続時に `SET SESSION sql_mode = ...` を発行し、上記リストに含まれるモードをすべて**セッションから削除**します。

MySQL 8.0 のデフォルトは：

```
ONLY_FULL_GROUP_BY, STRICT_TRANS_TABLES, NO_ZERO_IN_DATE, NO_ZERO_DATE,
ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION
```

WordPress 経由で接続するとセッションの sql_mode は：

```
NO_ZERO_IN_DATE, ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` も `NO_ZERO_DATE` も消えています。その状態で WordPress が `0000-00-00 00:00:00` を INSERT しても、MySQL 8.0 はエラーにしません。

WordPress が `post_date_gmt = '0000-00-00 00:00:00'` を意図的に書き込むコード（`wp-includes/post.php`）が今も存在するのは、この自衛機構があるからです。

---

## phpMyAdmin ダンプも STRICT を回避する

phpMyAdmin でエクスポートした `.sql` ファイルの冒頭には、必ずこのような行が入っています：

```sql
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
```

さくらの自動アップグレード機能は内部的に mysqldump と再インポートを行いますが、そのダンプ冒頭の `SET SQL_MODE` によってインポート中の sql_mode が上書きされます。

結果として、`0000-00-00` を含む INSERT 文がそのままインポートされても、エラーにはなりません。

---

## では、クレンジングは何だったのか

「WordPress も守っている、ダンプも守っている、なら調査もクレンジングも無駄だったのか」というと、そうではありません。

### phpMyAdmin で直接 SQL を叩くとき

WordPress 経由でなく phpMyAdmin の SQL タブから直接クエリを実行する場合、sql_mode はサーバー設定がそのまま使われます。

MySQL 8.0 環境の phpMyAdmin から次のクエリを実行すると：

```sql
SELECT * FROM wp_posts WHERE post_date_gmt = '0000-00-00 00:00:00';
```

```
ERROR 1525 (HY000): Incorrect DATETIME value: '0000-00-00 00:00:00'
```

`0000-00-00` を比較値に使うだけでエラーになります。DB に不正値が残っている限り、phpMyAdmin での直接操作は地雷だらけになります。

### サードパーティツールでバックアップ・リストアするとき

WordPress とダンプ形式が用意している「回避」は、それぞれの文脈でしか機能しません。別のバックアッププラグインや直接の `mysql` コマンドでインポートした場合、STRICT が有効なまま `0000-00-00` を挿入しようとしてエラーになる可能性があります。

### 「DB 自体が MySQL 8.0 の標準に準拠していない」状態が続く

WordPress が回避してくれているからといって、DB の中に `0000-00-00` が残り続けることは変わりません。将来の移行、監査、バグ調査のどこかで予期しない問題として浮上するリスクが残ります。

---

## アクセス経路ごとの整理

| アクセス経路 | sql_mode | `0000-00-00` の扱い |
|---|---|---|
| WordPress（wpdb 経由） | 接続時に STRICT / NO_ZERO_DATE を除去 | INSERT/UPDATE 成功 |
| phpMyAdmin | サーバー設定をそのまま使用 | SELECT でも ERROR 1525 |
| mysqldump → phpMyAdmin インポート | dump 冒頭の `SET SQL_MODE` で除去 | インポート成功 |
| mysql コマンド直接 / 一部ツール | サーバー設定をそのまま使用 | INSERT でエラーになる可能性 |

WordPress 経由の通常運用は守られています。壊れるのは「WordPress を通らない」文脈です。

---

## クレンジングの意義を再定義する

今回の調査全体を振り返ると、次のように整理できます。

**「クレンジングは WordPress を守るためではなかった」**

WordPress は自分で守る仕組みを持っている。クレンジングとは、**WordPress に依存せず、DB 自体を MySQL 8.0 の仕様に準拠させる作業**です。

「ボタン一発」で何も起きない理由も、これで説明できます。WordPress が設計として STRICT を回避するように作られているため、たいていの環境では問題が表面化しません。

ただし「表面化しない」と「問題がない」は違います。phpMyAdmin や外部ツールを使う場面では確実に問題になります。そして、問題に気づくのは往々にして「いちばん困るタイミング」です。

---

## まとめ

| 問い | 答え |
|---|---|
| クレンジングしなくても WordPress は動いたか？ | **動いた**（WordPress が STRICT を外しているため） |
| ダンプのインポートは成功したか？ | **成功した**（dump 冒頭の `SET SQL_MODE` が機能するため） |
| ではクレンジングは不要だったか？ | **DB の健全性のためには必要**（phpMyAdmin 操作、外部ツール、将来の移行に影響する） |
| 事前調査に意味はあったか？ | **あった**。「なぜ壊れないのか」の仕組みがわかったこと自体が成果 |

「押すだけで大丈夫」は正しい。ただしその理由は「MySQL 8.0 が緩い」からではなく、**WordPress が賢く立ち回っているから**です。

その構造を理解した上でクレンジングをするのと、何も知らずにボタンを押すのでは、同じ結果でも意味が違います。

---

**メイン記事**：[WordPress + MySQL 5.7 → 8.0 移行実録（さくらインターネット共用サーバー）](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)

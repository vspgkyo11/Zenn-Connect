---
title: "レンタルサーバーの MySQL は設定が緩い：MySQL 8.0 移行で 0000-00-00 問題が起きやすい理由"
emoji: "⚠️"
type: "tech"
topics: ["MySQL", "WordPress", "レンタルサーバー", "データベース"]
published: false
---

# レンタルサーバーの MySQL は設定が緩い：MySQL 8.0 移行で 0000-00-00 問題が起きやすい理由

## はじめに

さくらインターネットの共用サーバーで WordPress を MySQL 5.7 → 8.0 に移行したとき、まず確認したのが本番 DB の `sql_mode` だった。

`SELECT @@sql_mode;` を実行すると：

```
NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` が入っていなかった。

この設定が、`0000-00-00 00:00:00` という不正な日付値が数千件も蓄積していた直接の原因だった。「なぜレンタルサーバーはこういう設定になっているのか」を調べた内容をまとめる。

移行作業の全体像は「[WordPress + MySQL 5.7 → 8.0 移行実録](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)」を参照。

---

## 1. sql_mode と STRICT_TRANS_TABLES の関係

MySQL には「どこまで厳しくデータを検証するか」を制御する `sql_mode` がある。

| モード | 効果 |
|---|---|
| `STRICT_TRANS_TABLES` | 不正な値の INSERT/UPDATE をエラーにする（無効なら警告のみ） |
| `NO_ZERO_DATE` | `0000-00-00` 形式の日付を不正値として扱う |
| `ONLY_FULL_GROUP_BY` | GROUP BY の曖昧なクエリをエラーにする |

重要なのは `STRICT_TRANS_TABLES` と `NO_ZERO_DATE` の**組み合わせ**だ。

- `NO_ZERO_DATE` だけ有効 → `0000-00-00` を INSERT しても**警告のみで通過する**
- `NO_ZERO_DATE` + `STRICT_TRANS_TABLES` の両方が有効 → `0000-00-00` を INSERT すると**エラーになる**

さくら MySQL 5.7 は前者の状態だった。`0000-00-00` が警告すら記録されないまま何年も DB に入り続けた理由がここにある。

---

## 2. なぜレンタルサーバーは設定が緩いのか

さくら固有の話ではない。レンタルサーバー・共用ホスティング全般に共通しやすい構造的な事情がある。

**1. 古いアプリとの後方互換性を優先する**

共用サーバーには多種多様なアプリが同居している。`STRICT_TRANS_TABLES` を有効にすると、古いアプリのクエリが急にエラーになりクレームが増える。サービス提供者としては「緩くしておく」ほうが運用リスクが低い。

**2. ユーザーが sql_mode を変更できない**

専用サーバーや VPS なら `my.cnf` を直接編集できるが、共用サーバーではサーバー管理者だけが設定を変更できる。ユーザー側で厳格化する手段がない。

**3. MySQL のデフォルト設定が時代とともに厳格化された**

MySQL 5.6 以前はデフォルトで `sql_mode` がほぼ空だった。5.7 でも緩い設定のままにしているサービスが多く、8.0 で初めて厳格なデフォルトになった。バージョンアップより前から運用しているサーバーは、その設定を引き継いでいる。

---

## 3. 何が蓄積されるか

`STRICT_TRANS_TABLES` が無効な環境では、WordPress やプラグインが `0000-00-00 00:00:00` を書き込んでも MySQL は無言で受け入れる。代表的な発生パターンをまとめる。

**WordPress の auto-draft**

新規投稿画面を開くたびに生成される一時保存データ。公開日時が未設定の状態で `post_date_gmt = '0000-00-00 00:00:00'` が入る。今回の主な発生源で、数千件に及んだ。

**プラグインのログテーブル**

WP All Export など、処理日時を持つテーブルで初期値が `0000-00-00` になるケース（`wp_pmxe_exports`）。

**SEO プラグインのインデックステーブル**

Yoast SEO の `wp_yoast_indexable` など、クローリングやインデックス更新の日時カラム。

これらは MySQL 5.7 環境では「存在するが問題にならないデータ」として何年も蓄積される。サイトが古ければ古いほど件数は多い。

---

## 4. MySQL 8.0 に移行すると何が変わるか

MySQL 8.0 のデフォルト `sql_mode` は：

```
ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,
ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

`STRICT_TRANS_TABLES` が追加される。さくら MySQL 5.7 → 8.0 での実測値：

| モード | MySQL 5.7（移行前） | MySQL 8.0（移行後） |
|---|---|---|
| `STRICT_TRANS_TABLES` | **なし** | **あり** |
| `NO_AUTO_CREATE_USER` | あり | **なし**（MySQL 8.0 で廃止） |
| `NO_ZERO_IN_DATE` | あり | あり |
| `NO_ZERO_DATE` | あり | あり |
| `ERROR_FOR_DIVISION_BY_ZERO` | あり | あり |
| `NO_ENGINE_SUBSTITUTION` | あり | あり |

移行後に phpMyAdmin の SQL タブから `0000-00-00` を比較値に使うクエリを実行すると：

```
ERROR 1525 (HY000): Incorrect DATETIME value: '0000-00-00 00:00:00'
```

ただし WordPress 経由の通常運用やダンプのインポートはこのエラーが出ない。壊れるのは「WordPress を通らない」文脈に限られる。なぜそうなるかは「[クレンジングは本当に必要だったのか](https://zenn.dev/vspgkyo11/articles/cleansing-was-it-necessary)」で掘り下げている。

---

## 5. 移行前の確認方法

確認は一行で終わる。

```sql
SELECT @@sql_mode;
```

結果に `STRICT_TRANS_TABLES` が**含まれていなければ**、`0000-00-00` が蓄積しているリスクがある。

次に件数を確認する。ダンプファイルがあれば：

```bash
grep -c "0000-00-00 00:00:00" dump.sql
```

0 件であれば問題なし。1 件以上あれば移行前にクレンジングが必要になる。クレンジングの具体的な手順は「[WordPress + MySQL 5.7 → 8.0 移行実録](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)」の STEP 2 を参照。

---

## まとめ

| 確認ポイント | コマンド |
|---|---|
| sql_mode の確認 | `SELECT @@sql_mode;` |
| 0000-00-00 の件数確認 | `grep -c "0000-00-00 00:00:00" dump.sql` |

「なぜ緩いのか」は運用上の都合と MySQL の歴史的経緯が重なっている。ユーザー側でどうにもできない設定だからこそ、移行前に `SELECT @@sql_mode;` で実態を確認することが重要だ。

---

**メイン記事**：[WordPress + MySQL 5.7 → 8.0 移行実録（さくらインターネット共用サーバー）](https://zenn.dev/vspgkyo11/articles/wordpress-mysql8-upgrade-record)
**関連記事**：[クレンジングは本当に必要だったのか：WordPress が sql_mode を自分で外していた話](https://zenn.dev/vspgkyo11/articles/cleansing-was-it-necessary)

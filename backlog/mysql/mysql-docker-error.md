---
title: "【MySQL】macOSで発生した Docker + MySQLDB 接続エラーの原因と対処法"
emoji: "🛠️"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["MySQL"]
published: false
---

## はじめに

DockerでMySQLDBを起動しているにも関わらず、接続エラーでつまずいた経験はありませんか？

この記事では、私が遭遇した「MySQLDB接続トラブル」をもとに、接続エラーの切り分け方法や対処法を具体的に紹介します。
この記事では、エラーの原因を切り分けるための具体的なコマンドや設定方法も紹介します。

特に、ポート3306の競合が原因でDockerコンテナに接続できないケースについて、実例とともに解説していきます。

## 対象者

- DockerでMySQLDBを扱う人
- DBクライアントから接続できずに困っている人

## 接続時に遭遇した主な問題

Dockerで起動しているMySQLDBコンテナに、VS CodeのDB拡張やCLIから接続しようとすると、以下のようなエラーが発生しました。

- `Access denied for user 'local'@'localhost'`
- MySQLDBを利用している場合に頻出する `RSA public key is not available client side` エラー
- `Communications link failure`

phpMyAdmin（Docker内部）からは接続できていたため、接続元が異なることで発生していると推測しました。

## 原因と調査

### lsof によるポート使用状況の確認

```bash
lsof -i :3306
```

`lsof` は 'list open files' の略で、ネットワークポートを使用中のプロセスを調べるのに役立ちます。

出力例の一部を抜粋しつつ、各行の意味を以下に示します

```
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
Code H  1760 User   39u  IPv4 ... TCP localhost:59166->localhost:mysql (ESTABLISHED)
mysqld     2091 User   34u  IPv4 ... TCP localhost:mysql (LISTEN)
mysqld     2091 User   49u  IPv4 ... TCP localhost:mysql->localhost:59166 (ESTABLISHED)
com.docke 16119 User  217u  IPv6 ... TCP *:mysql (LISTEN)
```

- `mysqld` の `(LISTEN)`：macOS上でMySQLがポート3306を使用中（待ち受け中）であることを示します。
- `Code H` の `(ESTABLISHED)`：VS Code などのクライアントが、MySQLサーバーに対して接続している状態です。
- `com.docke`（Dockerデーモン）の `*:mysql (LISTEN)`：Dockerも同じポートを使おうとしているが、衝突の可能性があります。

このように、ポート3306がすでに macOS の MySQL に占有されていたため、Docker の MySQLDB がバインドできず、接続に失敗していたと考えられます。

### ローカルMySQLの停止

HomebrewでインストールされたMySQLが自動起動していたため、次のコマンドで停止しました。

```bash
brew services stop mysql
```

なお、停止状態を確認したい場合は `brew services list` を使うと便利です。

macOS上のMySQLを停止したことで、Dockerコンテナがポート3306を確保できるようになり、接続の問題が解消されました。

## 他にも発生したトラブルと対策

### ユーザー権限の問題

```sql
CREATE USER 'local'@'%' IDENTIFIED BY 'パスワード';
GRANT ALL PRIVILEGES ON *.* TO 'local'@'%';
FLUSH PRIVILEGES;
```

### 認証方式の問題

MySQLDB では `caching_sha2_password` による認証で失敗することがあるため、次のように変更しました。

```sql
ALTER USER 'local'@'%' IDENTIFIED BY 'パスワード';
```

### ホスト名の問題

Docker外から `localhost` を使うと接続できないため、明示的に `127.0.0.1` を指定するようにしました。

```bash
mysql -h 127.0.0.1 -P 3306 -u local -p
```

## よくある接続エラーと試したこと

以下は、今回の接続エラーで実際に発生した問題点と、それに対して試行錯誤した内容です。どれもDocker × MySQLDBの構成でよく起きるトラブルです。

### 発生した問題

1. `Access denied for user 'local'@'localhost'`
   - ⇒ ユーザーのホスト制限と権限ミス
2. phpMyAdminからは接続できるが、VS Codeなどホストからの接続は失敗
   - ⇒ コンテナ内部からの接続と外部からの接続の違い
3. `RSA public key is not available client side`
   - ⇒ 認証方式 `caching_sha2_password` に起因
4. `Communications link failure`
   - ⇒ ホストとDB間で物理的に接続できていない
5. `Dockerがポート3306をバインドできない`
   - ⇒ ローカルMySQLがすでにポートを使用中

### 試したこと（対応内容）

- Laravel Tinkerから接続を試行
- ユーザー `local@'%'` を作成、権限付与、FLUSH
- 認証方式を変更し、`ALTER USER` で再設定
- 接続ホストを `127.0.0.1` に変更
- CLIからの直接接続テスト
- VS CodeのDBクライアントから再接続テスト

そして最も効果的だったのが：

- `lsof -i :3306` でポートの競合を調査
- `brew services stop mysql` でOS上のMySQLを停止

実は、これを最初に確認していればすぐに解決していたはずでした。ポートの使用状況は見落としがちですが、トラブル時にはまず最初に確認すべきポイントです。


## 得られた学び

- ホストOSのMySQLがポートを使っている場合、Dockerが使用できず接続に失敗する
- `lsof` でポートの使用状況をチェックすることで、競合を即座に特定できる
- MySQLDB接続トラブルは「ユーザー設定」「ホスト指定」「認証方式」「ネットワーク」など、各レイヤーの問題を分けて調査する姿勢が大切です

## おわりに

今回の体験を通じて、MySQLDB接続エラーの背後にある「システム間のつながり」への理解が深まりました。

初心者の頃は「なんで接続できないんだ」と焦るばかりでしたが、今は `lsof` や `brew services stop` などの基本操作を身につけたことで、問題の切り分けと早期解決ができるようになりました。同様に `lsof` や `brew services` などのコマンドに慣れておくと、他のトラブルにも応用が利きます。

この記事が同じようなエラーで困っている方の突破口になれば幸いです。

---

## 株式会社ONE WEDGE
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/
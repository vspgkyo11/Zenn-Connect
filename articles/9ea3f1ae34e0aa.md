---
title: "【Laravel】自動テストの環境構築"
emoji: "🧪"
type: "tech"
topics: ["Laravel", "テスト", "PHPUnit", "FeatureTest", "自動化"]
published: true
---

## はじめに

LaravelでWebアプリケーションを開発し、デプロイが目前に迫ると「本当にすべて正常に動作するのか」と不安になる瞬間が訪れます。本番デプロイ前は、ローカルと挙動が異なることもあるため、事前の検証は不可欠ですが、自動テストを実施する前には様々な準備が必要です。本記事では、自動テストの環境構築に関する準備に必要な項目を紹介します。

## 対象者

* Laravelアプリを初めて本番公開するエンジニア
* アプリの手動テストに不安がある方
* デプロイのたびに同じ手動テストの繰り返しから解放されたい方


## テスト環境の準備手順

自動テストの目的は、本番環境にデプロイする前に、主要機能が意図通り動作するかどうかを網羅的に確認することです。
手動テストで確認しきれない部分を自動化することで品質を高めるため、以下の内容を実施することでテスト環境の構築準備ができます。

## ファイル構成例

```text
 tests/
├── Feature/
│   ├── Auth/
│   │   ├── LoginTest.php
│   │   └── RegisterTest.php
│   ├── User/
│   │   ├── AppFormTest.php
│   │   └── HealthFormTest.php
│   ├── Admin/
│   │   └── AdminUserManagementTest.php
│   └── Mail/
│       └── RegistrationMailTest.php
├── Unit/
│   └── Requests/
│       ├── RegisterRequestTest.php
│       ├── AppFormRequestTest.php
│       └── HealthFormRequestTest.php
```

### 事前準備チェックリスト（テスト実行前）

| 項目  | コマンド・内容   | 備考   |
| --------------------- | ---------------------------- | ------------------------------------------------ |
| `.env.testing` の確認・作成 | `.env` をベースに `.env.testing` を作成し、以下を上書き<br>APP\_ENV=testing<br>APP\_KEY=base64\:xxx（正しいキー）<br>DB\_DATABASE=\:memory: または test\_db | `.env.testing` が無いと暗号化エラー（cipher）が起こる            |
| キャッシュのクリア             | `php artisan config:clear`<br>`php artisan cache:clear`<br>`php artisan view:clear`                                               | `.env.testing` を反映するため                           |
| APP\_KEY の生成（必要時）     | `php artisan key:generate --env=testing`                                                                                          | `.env.testing` にキーがないと encryption エラー            |
| テスト用マイグレーション          | `php artisan migrate --env=testing` または<br>`php artisan migrate:fresh --env=testing`                                              | SQLite（\:memory:）を使う場合は `RefreshDatabase` が自動実行  |
| テスト用Seederの整備         | `DatabaseSeeder` で必要な初期データや Enum 定義を整備<br>例：`UserSeeder` など                                                                       | 特定の状態が必要なテスト時                                    |
| Factoryの定義確認          | `database/factories/*.php` にテーブル定義と整合するフィールドを記述                                                                                   | `FormData::factory()` エラー回避に重要                   |
| テストデータベース接続確認         | `.env.testing` でDB接続先を test 用（例：SQLite）にしているか                                                                                     | `DB_CONNECTION=sqlite`、`DB_DATABASE=:memory:` など |


### よくあるエラーと対処

| エラー内容                                        | 対処                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `Unsupported cipher or incorrect key length` | `.env.testing` に `APP_KEY` が未設定 or 無効。`php artisan key:generate --env=testing` |
| `Call to undefined method Model::factory()`  | Factory ファイルが未作成 or namespace/return 書き忘れ                                      |
| DBが空でテスト失敗                                   | テスト用DBが初期化されていない。`php artisan migrate:fresh --env=testing`                     |


## テスト実行コマンド例

### 実行フロー

```bash
cp .env .env.testing  # 初回のみ
php artisan config:clear
php artisan key:generate --env=testing
php artisan migrate --env=testing
php artisan test # テスト実行
```

```bash
php artisan test --filter=User/
php artisan test --filter=Admin/
php artisan test --parallel
```

## 注意点

* 本番サーバーでは `APP_ENV=production` に設定しておき、`php artisan test` が実行されないよう制限しておく

```php
if (app()->environment('production')) {
    abort(403, '本番環境ではテストを実行できません');
}
```

* テストの実行は、必ずローカルまたは検証環境で行うこと
* Laravelの`phpunit.xml`内で、MailやDatabaseの設定がテスト用に切り替わっているか確認する


## テスト実行環境における SQLite と MySQL の使い分けについて

テスト実行時に使用するデータベースとして、SQLite（特にin-memory）を使うことで、MySQLよりも構築が容易でスピードも速く、手軽にテストを繰り返すことができます。

| 比較項目        | SQLite                 | MySQL                |
| ----------- | ---------------------- | -------------------- |
| セットアップ      | `.env.testing` に1行書くだけ | MySQLサーバー起動・DB作成が必要  |
| 実行速度        | 非常に高速（in-memory対応）     | 中〜高速（DBサーバー次第）       |
| CI/CD対応     | GitHub Actionsなどで扱いやすい | MySQLセットアップのコストがある   |
| テストデータの巻き戻し | `RefreshDatabase`で初期化可 | トランザクションやtruncateで対応 |
| 制約の厳密性      | 外部キー制約などが甘い            | 本番と同等の制約でテストできる      |

### 結論：どう使い分けるべき？

| テスト目的       | 推奨DB   | 理由                            |
| ----------- | ------ | ----------------------------- |
| バリデーション検証   | SQLite | 軽量・速い・構築が楽                    |
| CRUD確認      | SQLite | `RefreshDatabase` により毎回初期化が簡単 |
| 複雑なリレーション確認 | MySQL  | 実際のDB構造と制約に近づけたい場合はMySQLが安全   |
| 本番に極めて近いテスト | MySQL  | 全く同じ挙動を担保したい場合                |

まずはSQLiteで開発スピードを上げ、重要なロジックや制約まわりだけMySQLでのテストも併用するハイブリッドな戦略が現実的です。


## テスト要件の整理
Webアプリのどんなテストをしたいか要件を整理しておくことも大切です。具体例を以下に記載します。

### 対象画面

* 一般ユーザー画面（User）
* 管理者画面（Admin）

### テスト種別

* 正常系（Happy Path）
* 異常系（Validation error、認可エラーなど）

#### テスト範囲（例）

* ログイン／登録／パスワードリセット
* ユーザー情報登録・更新（user\_data, form\_data など）
* 管理者画面でのユーザー一覧・編集
* フォーム送信（AppForm・HealthForm）
* メール送信（登録完了、管理者通知）

### テスト内容の網羅基準

| 区分           | チェックポイント例                        |
| ------------ | -------------------------------- |
| 認証関連         | ログイン成功／失敗、リダイレクト確認               |
| ユーザー登録       | バリデーション、重複チェック、登録完了メール送信         |
| 各フォーム        | 入力正常系／未入力／形式不正／保存成功確認            |
| 画面遷移         | ロールごとのルート制御、未ログイン時の挙動            |
| Admin操作      | 管理者専用ページへのアクセス、編集処理の確認           |
| メール送信        | 登録完了・通知メールが Mail::fake で送信されたか確認 |
| CSRF/Session | トークン未送信時の挙動、セッション期限切れ            |

> **チェック基準（例）**
>
> * 全ルートURLについて1件以上の正常系・異常系テストを実装する
> * FeatureTestのカバレッジをroutes/web.php全体の80%以上とする
> * FormRequest単体でバリデーション条件の100%をUnitTest化する


## 実装方針

テスト要件が整理出来たら、実際にどんなテストコードを書いていくか実装方針を具体化します。

* LaravelのFeatureTestを用いて、画面操作・レスポンスを検証
* FormRequestのUnitTestでバリデーション単体確認
* Mail::fake()でメール送信の挙動確認
* DatabaseTransactionsを活用し、テスト後にデータをロールバック
* データ準備はSeeder・Factoryを活用して再利用可能に

### Mail::fake() の使用例

```php
public function test_registration_mail_is_sent()
{
    Mail::fake();

    $response = $this->post('/register', [
        'name' => 'テストユーザー',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    Mail::assertSent(WelcomeMail::class, function ($mail) {
        return $mail->hasTo('test@example.com');
    });
}
```

### DatabaseTransactions の使用例

```php
use Illuminate\Foundation\Testing\DatabaseTransactions;

class RegisterTest extends TestCase
{
    use DatabaseTransactions;
    ...
}
```

### CSRFトークン未送信時の異常系テスト例

```php
public function test_form_submission_without_csrf_should_fail()
{
    $response = $this->post('/submit', [
        'name' => '未認証',
    ], ['X-CSRF-TOKEN' => '']);

    $response->assertStatus(419); // LaravelのCSRF保護エラー
}
```

---

## おわりに

私はLaravelアプリをサーバーに本番公開する際、本当に全て動作するのか不安でテストを繰り返した経験があります。そんなとき、自動テストを実施しましたが、その環境を整えることにもいくつかの手順を踏まないといけませんでした。テストコードを実行するまでにも時間がかかってしまいました。本記事が、自動テスト環境構築の一助になれば幸いです。

---

## 株式会社ONE WEDGE
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/
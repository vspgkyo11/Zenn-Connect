# Zenn-Connect リポジトリ運用ガイド

このリポジトリの構成・運用ルール・命名規則をまとめた「地図」です。
記事が増えて迷子になりがちな運用を、ファイル名と戦わずに管理するための指針を記します。

> 最終更新: 2026-07-01 / 対象: 公開記事 61本・下書き14本（`articles/` 計75本、索引は再生成済み）

---

## 0. 最重要ルール（先に読む）

### ⚠️ 公開済み記事のファイル名（スラッグ）は絶対に変えない

Zenn では **ファイル名 ＝ 記事の公開URL** です。

```
articles/efd31b50df3172.md
        └──────┬──────┘
      これがそのまま URL になる
      → https://zenn.dev/vspgkyo11/articles/efd31b50df3172
```

ファイル名を変更すると Zenn 側では「旧記事が削除され、別記事が新規投稿された」扱いになり、
以下がすべて失われます。

- いいね・コメント・閲覧数
- SEO評価（検索順位）
- 外部リンク・SNSシェア・ブックマーク（旧URLは 404）

**あのランダム文字列は「見にくいファイル名」ではなく「記事の永続ID」です。**
見やすさは後述の索引レイヤー（`docs/article_index.md`）で担保し、ファイル名は触りません。

---

## 1. ディレクトリ構成と役割

| パス | Git管理 | 役割 |
| --- | :---: | --- |
| `articles/` | ✅ | **公開・下書きの本体**。Zenn が同期する。ファイル名＝スラッグ＝URL。 |
| `books/` | ✅ | Zenn の「本」機能用。**当面使わない方針**（`.keep` のみで放置でOK）。 |
| `images/` | ✅ | 記事に使う画像。Zenn 仕様で**リポジトリ直下 `/images` が必須**。記事からは `/images/...` で参照。 |
| `drafts/` | ❌（除外） | **公開前の作業場**。`.gitignore` 済みでプッシュされない。ここは自由な命名でOK。 |
| `docs/` | ✅ | このガイド・索引・執筆スタイル分析などの**メタ情報**。 |
| `scripts/` | ✅ | 索引生成などの運用スクリプト。 |
| `archive/` | ✅ | 退避用（現在空）。役割は §6 で定義。 |
| `.agents/` | ✅ | AIエージェント用のルール・スキル定義。 |
| `README.md` | ✅ | Obsidian 連携の注意書き（直接編集禁止の周知）。 |

### articles/ の中身は2種類

フロントマターの `published` で状態が分かれます（ファイルの場所は同じ）。

- `published: true` … 公開済み（61本）→ **リネーム・削除は厳禁**
- `published: false` … 下書きとして push 済み（14本）→ まだURL未確定なのでスラッグ変更の余地あり（§4）

---

## 2. 記事のライフサイクル

```
[着想]           [執筆・推敲]              [公開準備]                [公開]
Obsidian    →    drafts/ (git管理外)  →   articles/ にコピー    →   published: true にして push
10_notes /       自由な名前でOK          Zennスラッグを確定        以降スラッグは固定
11_Idea          _refined 等で反復        (§4の命名規則)
```

- **草稿は `drafts/` で育てる**：命名自由・何度でもリネーム可・push されない。
- **`articles/` へ移す時点でスラッグを決め切る**：ここから先は名前が永続IDになる。
- **公開は `published: true`**：`articles/` に置いても `false` の間は Zenn 上で下書き扱い。

> Obsidian 連携の原則（README より）：草稿は Obsidian の `10_notes`/`11_Idea` に置き、
> このリポジトリは「参照専用」。Obsidian から直接 `articles/` を編集しない。

---

## 3. 新規記事の作り方

公式CLI（`zenn-cli`）でスラッグを**自分で指定**して作成します。

```bash
# スラッグを明示して作成（推奨）
npx zenn new:article --slug laravel-session-separation

# プレビュー（ローカル確認）
npx zenn preview
```

`--slug` を省くとランダム文字列になります。過去記事がそうなっているのは省略していたためで、
**これからは意味のあるスラッグを付けられます。**

---

## 4. スラッグ命名規則

### Zenn の技術的制約（絶対）
- 使える文字：**半角英小文字 `a-z` / 数字 `0-9` / ハイフン `-` / アンダースコア `_`**
- 長さ：**12〜50文字**
- **公開後は変更不可**（=最初に決め切る）

### このリポジトリの推奨フォーマット
```
<カテゴリ>-<トピック>[-<補足>]
```

| 例 | 意図 |
| --- | --- |
| `laravel-session-separation` | Laravel × セッション分離 |
| `nextjs16-middleware-to-proxy` | Next.js 16 の middleware→proxy 移行 |
| `gas-gmail-auto-delete` | GAS × Gmail 自動削除 |

- **カテゴリ**は既存トピックに合わせる：`laravel` / `nextjs` / `php` / `docker` / `gas` / `windows` / `linux` など。
- 迷ったら「半年後の自分がURLを見て内容を思い出せるか」を基準に。
- **既存の61本には遡及適用しない**（リネーム禁止）。新規ぶんから運用。

---

## 5. 索引（人間用の目次）の運用

ファイル名が機械用IDである以上、**人間が記事を探すのは索引でやる**のが正攻法です。

- 生成物：[`docs/article_index.md`](./article_index.md) … タイトル・絵文字・トピック・概要の一覧
- 生成元：[`scripts/generate_index.py`](../scripts/generate_index.py) … `articles/*.md` を走査して自動生成

```bash
# 依存（初回のみ）。Homebrew管理のPythonは pip install が制限されているため venv を使う
python3 -m venv .venv-scripts
.venv-scripts/bin/pip install python-frontmatter

# 索引を再生成（リポジトリ直下で実行）
.venv-scripts/bin/python3 scripts/generate_index.py
```

`.venv-scripts/` はグローバル `.gitignore` で除外されるため、コミット対象には入らない。

### 執筆傾向の分析（analyze_articles.py）

`docs/article_index.md` が「何を書いたか」の一覧なのに対し、
[`scripts/analyze_articles.py`](../scripts/analyze_articles.py) は**「どう書いているか」＝執筆の特徴・癖を分析**するスクリプトです。

- 文字数・見出し数（H2/H3）・コードブロック数・画像数などを記事ごとに集計
- トピック／絵文字／`type` の出現頻度を集計
- 本文の内容から記事タイプを推定（troubleshooting / comparison / tutorial / explanation）
- 記事中のバージョン表記（`Laravel 10`, `v1.2.3` など）を抽出

```bash
# JSON形式で全データを出力
.venv-scripts/bin/python3 scripts/analyze_articles.py --json
```

この分析結果は [`docs/writing_style.md`](./writing_style.md)（執筆傾向分析レポート）のベースになっています。
索引と違い**定期更新の運用ルールは定めていない**ため、執筆スタイルを見直したい時にスポットで実行する位置づけです。

---

## 6. 画像・退避ファイルの扱い

### images/
- Zenn 仕様上、**リポジトリ直下 `/images` に置くことが必須**。
- 記事内からは絶対パス `/images/フォルダ名/xxx.png` で参照。
- 命名は記事に紐づく説明的な名前を推奨（例：`laravel-dropzone/`, `db_security/`）。
  スラッグとは無関係なので、こちらは分かりやすさ優先でOK。

### archive/
現在は空。以下の用途に限定して使うと `articles/` が汚れません。
- **非公開化した記事の退避**：Zenn 同期対象外にしたい記事を移す。
  （ただし公開済みだった記事は移動＝URL消滅になるため、`published: false` で残すほうが安全）
- 公開予定のない実験・供養ネタの保管。

---

## 7. 既知の課題 / TODO

このリポジトリで今後整えると良い点。

- [x] `scripts/generate_index.py` の出力先を `docs/article_index.md` に統一（§5の不整合）
- [x] 索引 `article_index.md` を最新の75本で再生成
- [x] `docs/article_index.md` の見出し／案内コマンドのパスを実態に合わせる
- [x] README にこのガイドへのリンクを追加して発見性を上げる
- [x] `scripts/analyze_articles.py` の役割をこのガイドに追記
- [x] `books/` を使わないなら方針を明記

---

## 8. まとめ（迷ったら）

- **ファイル名は触らない。** 見やすさは `docs/article_index.md` で解決する。
- **草稿は `drafts/`、公開は `articles/`。** スラッグは `articles/` 入りのタイミングで確定。
- **新規は `--slug` で意味のある名前を。** 規則は §4。
- **記事を増やしたら索引を再生成。** それが唯一の「一覧を最新に保つ」手段。

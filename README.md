# Zenn-Connect (Obsidian 連携注意)

このフォルダは Zenn 投稿用のリポジトリです。  
Git 管理＋自動デプロイ対象のため、**Obsidian 側から直接編集は行わないでください。**

## 運用ルール
- 記事草稿は Obsidian の 10_notes または 11_Idea に保存する
- 投稿準備が整ったら、このフォルダの `articles/` にコピーする
- Obsidian では「参照専用」として扱い、リンク・検索には含める

## ドキュメント
- [リポジトリ運用ガイド](docs/repository_guide.md) — ディレクトリ構成、記事のライフサイクル、スラッグ命名規則など
- [記事一覧インデックス](docs/article_index.md) — 全記事の概要一覧（`python3 scripts/generate_index.py` で更新）

## npm スクリプト（Zenn CLI エイリアス）
| コマンド | 内容 |
| --- | --- |
| `npm run preview` | ローカルプレビューを起動 |
| `npm run new:article -- --slug <slug>` | 新しい記事を作成 |
| `npm run new:book -- --slug <slug>` | 新しい本を作成 |
| `npm run list:articles` | 記事一覧を表示 |
| `npm run list:books` | 本一覧を表示 |

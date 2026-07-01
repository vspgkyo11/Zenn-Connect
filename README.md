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

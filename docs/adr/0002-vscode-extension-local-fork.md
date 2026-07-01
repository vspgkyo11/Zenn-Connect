# 0002. vscode-extension/ を非公開のローカルフォークとして自作する

- **Status**: Accepted
- **Date**: 2026-07-01

## Context

Zenn CLI を VS Code / Cursor に統合する非公式拡張機能 `negokaz/vscode-zenn-editor`（MIT License）を使いたかったが、VS Code Marketplace 上のページが404になっており、公開停止（retired）済みだった。Open VSX レジストリにも登録がなく、GitHubリリースにも `.vsix` の配布がないため、正規の入手経路が存在しない状態だった。

## Decision

`negokaz/vscode-zenn-editor` のソースコード（MIT）をセキュリティ監査（難読化・不審な通信先・インストールフック等の確認）した上で、これを土台に `vscode-extension/` として本リポジトリ内にフル機能（ツリービュー・プレビュー・新規記事/本の作成・画像アップロード）を再実装した。非公開・個人利用限定（`"private": true`、Marketplaceには公開しない）とする。

## Consequences

- MITライセンスを継承し、`vscode-extension/LICENSE` と `README.md` に原作者（Kazuki Negoro氏）へのクレジットを明記する
- `vscode-extension/` はルートとは別のnpmプロジェクト（独自の`package.json`・`node_modules`）として存在する。依存関係の更新やビルドはルートの `npm install` とは別に `cd vscode-extension && npm install` が必要
- ビルド成果物 (`.vsix`) は都度 `npm run package && npx vsce package --no-yarn` で生成し、`code --install-extension` で手動インストールする（自動更新の仕組みはない）
- 本家が将来的に復活・更新された場合でも、このフォークは追従せず独立して保守する

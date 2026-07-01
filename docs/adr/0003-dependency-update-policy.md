# 0003. 依存関係の更新はnpm auditだけに頼らず上流の変更履歴を確認する

- **Status**: Accepted
- **Date**: 2026-07-01

## Context

ルートの `zenn-cli` (`0.4.7`) に対して `npm audit` は「脆弱性0件」と報告していたが、実際には upstream (`github.com/zenn-dev/zenn-editor`) のコミット履歴を確認したところ、`zenn preview` の `/images/*` ルートに実在するパストラバーサル脆弱性の修正が `0.4.8-alpha.1` で行われていた（`root: process.cwd()` のままだと `..%2Farticles%2Fxxx.md` のようなリクエストで `images` 外のファイルが読めてしまう問題）。`npm audit` はnpm registryに登録された既知CVEしか検出しないため、これを見逃していた。

また `vscode-extension/` の依存更新では、`get-port` や `which` に新しいメジャーバージョンがあったが、それらはESM-only化されており、webpack + ts-loader (CommonJS前提) のビルドを壊す可能性があった。

## Decision

- 依存関係を「更新すべきか」判断する際は、`npm audit` の結果だけで済ませず、パッケージの公開元リポジトリで実際のコミット履歴・変更内容を確認する（monorepoでpackage単位のCHANGELOGがない場合は `git log <old-tag>..<new-tag> -- <package-path>` で確認する）
- 実際に脆弱性やバグ修正が確認できたものは積極的に上げる（例: zenn-cli 0.4.7 → 0.5.2）
- 既知の脆弱性がなく、かつメジャーバージョン更新がビルド方式（CJS/ESM等）を壊す可能性がある依存は、無理に最新化しない（例: `vscode-extension` の `get-port`, `which`, `ps-tree` は5系/2系に留め置き）

## Consequences

- 依存更新のたびに「バージョン番号を上げるだけ」ではなく、upstreamの変更内容を確認する一手間が発生する
- 一部の依存（get-port, which, ps-tree等）は意図的に古いメジャーのまま固定されており、将来的にビルド構成をESM対応に変更する際はまとめて見直す必要がある

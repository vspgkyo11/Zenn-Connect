# ADR (Architecture Decision Records)

このリポジトリで行った「後から理由を忘れそうな決定」を記録する場所です。
手順（How）は [docs/repository_guide.md](../repository_guide.md) に、決定の理由（Why）はここにまとめ、内容が重複しないようにします。

## フォーマット

各ADRは以下の構成とします。

- **Status**: Accepted / Superseded など
- **Context**: なぜこの決定が必要になったか
- **Decision**: 何を決めたか
- **Consequences**: その結果生じるトレードオフ・制約

## 一覧

| # | タイトル | Status |
| --- | --- | --- |
| [0001](./0001-never-rename-published-article-slugs.md) | 公開済み記事のファイル名（スラッグ）はリネームしない | Accepted |
| [0002](./0002-vscode-extension-local-fork.md) | vscode-extension/ を非公開のローカルフォークとして自作する | Accepted |
| [0003](./0003-dependency-update-policy.md) | 依存関係の更新はnpm auditだけに頼らず上流の変更履歴を確認する | Accepted |

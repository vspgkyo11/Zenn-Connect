# Zenn Editor (Local Fork)

このディレクトリは、Zenn CLI を Cursor / VS Code に統合するローカル専用の拡張機能です。
オリジナルの [negokaz/vscode-zenn-editor](https://github.com/negokaz/vscode-zenn-editor)（MIT License）が
VS Code Marketplace から公開停止（retired）されていたため、そのソースコードを参考に、
Zenn-Connect リポジトリ内で個人利用・非公開配布用として作成したものです。

## 機能

- **Zenn Contents ツリービュー**（エクスプローラー）: `articles/` `books/` の一覧を、下書き/公開のアイコン付きで表示
- **プレビュー**: エディタ右上のアイコンから `zenn preview` を起動し、Webview 内で記事/本をプレビュー
- **新規記事・本の作成**: ツリービューのボタンから `zenn new:article` / `zenn new:book` を実行
- **画像アップロード**: ステータスバーから Zenn の画像アップロードページを開く

## ビルド・インストール

```bash
cd vscode-extension
npm install
npm run package
npx vsce package --no-yarn --allow-missing-repository
code --install-extension zenn-editor-local-0.1.0.vsix
```

## ライセンス

MIT License。オリジナル（Copyright (c) 2021 Kazuki Negoro）のコードを土台にしています。詳細は [LICENSE](./LICENSE) を参照してください。

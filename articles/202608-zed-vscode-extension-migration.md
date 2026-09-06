---
title: "【Cursor→Zed】VS Code拡張が効かない移行で詰まった3つの壁とZenn執筆環境の落としどころ"
emoji: "🌊"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["Zed", "VSCode", "Zenn", "エディタ"]
published: false
---

## はじめに

CursorからZedに乗り換えてみたところ、記事執筆用に整えていた `.vscode/settings.json` が丸ごと無視されてしまい、ファイルツリーのネスト表示も崩れ、頼りにしていたZenn用のVS Code拡張も動かなくなりました。

CursorはVS Codeのフォークなので、これまで `.vscode/settings.json` に書いた設定や拡張機能がそのまま流用できていました。しかしZedは完全に別実装のエディタです。「同じような設定ファイルがあるはず」という思い込みで移行すると、想像以上に多くのものを作り直す羽目になります。本記事では、Zenn記事を書く環境をZedに移そうとして実際にぶつかった壁と、現時点での落としどころをまとめます。

## 対象者

* CursorやVS CodeからZedへの移行を検討している方
* Zennなどで技術記事を書いており、執筆環境を整えたい方
* `.vscode/settings.json` や VS Code拡張に依存したワークフローを持っている方

## 壁1: `.vscode/settings.json` がそもそも読まれない

ZedはRust製の別実装エディタで、VS Codeの設定ファイルを継続的に読み込む仕組みを持っていません。初回セットアップ時に「VS Codeから設定をインポート」というワンショットの機能はありますが、それ以降は `.vscode/settings.json` を編集してもZed側には一切反映されません。

Zedの設定ファイルは次の2箇所に分かれています。

* プロジェクト設定: `.zed/settings.json`(リポジトリのルートに作成)
* グローバル設定: `~/.config/zed/settings.json`

そこで、`.vscode/settings.json` に書いていた設定のうち移せるものだけを `.zed/settings.json` に移植しました。

```json:.vscode/settings.json (移行前)
{
    "files.autoSave": "onFocusChange",
    "editor.wordWrap": "on"
}
```

```json:.zed/settings.json (移行後)
{
  "autosave": "on_focus_change",
  "soft_wrap": "editor_width"
}
```

対応表にするとこうなります。

| VS Code | Zed |
| --- | --- |
| `files.autoSave: "onFocusChange"` | `"autosave": "on_focus_change"` |
| `editor.wordWrap: "on"` | `"soft_wrap": "editor_width"` |

## 壁2: ファイルツリーのネスト表示(`explorer.fileNesting`)が存在しない

記事数が増えてきたため、VS Codeの `explorer.fileNesting.patterns` を使って古い記事を1つの親ファイルの下にまとめて表示していました。ところがZedの公式ドキュメントやAll Settingsリファレンスを確認しても、この機能に相当するものが見当たりません。プロジェクトパネルにはインデント幅などの表示調整はあるものの、パターンでファイルを親子関係にまとめる機能自体がまだ実装されていないのです。

:::message
GitHub上には同様の要望Issueが上がっていますが、本記事執筆時点(2026年8月)ではまだ実装されていません。今後のアップデートで来る可能性はあります。
:::

現時点では設定でどうにかできる話ではないので、フォルダ構成そのものを年月単位で分けるなど、物理的なディレクトリ構成で解決するしかなさそうです。

## 壁3: Zenn用のVS Code拡張がそもそも動かない

一番痛かったのがこれです。ZennにはCLIを統合するVS Code拡張として [negokaz/vscode-zenn-editor](https://github.com/negokaz/vscode-zenn-editor) がありましたが、Marketplaceから公開停止(retired)されていました。そこで以前、そのソースコードを参考にローカルフォーク版の拡張(`zenn-editor-local`)を自作し、`.vsix` にパッケージしてCursorにインストールして使っていました。

このローカル拡張をZedでも使えないかと `.vsix` を持ち込もうとしたのですが、そもそもZedは「VS Code拡張のAPIを一切サポートしない」という方針を明確に打ち出しています。`code --install-extension` に相当するVS Code拡張の読み込み口自体がZedには存在しないため、Marketplace版だろうとローカルビルド版だろうと結果は同じで、動かせません。

つまり今回のケースは「公開停止されていたから自作した」という工夫が、エディタを変えた瞬間に振り出しに戻るという結末でした。Webview・TreeDataProvider・コマンドパレット連携といったVS Code拡張API前提で書かれた資産は、Zed拡張(WASMベースの別API)として書き直さない限り流用できません。

## 現実的な落としどころ: `zenn-cli` はエディタに依存しない

拡張機能は諦めるとして、記事プレビュー自体は問題なく続けられます。`zenn-editor` 拡張はVS Code拡張ですが、`zenn-cli` はただのNode製CLIなので、エディタに依存しません。

```bash
npx zenn preview
```

を実行して `http://localhost:8000` をブラウザで開けば、これまで通りリアルタイムプレビューが見られます。Zedのターミナルパネルでこのコマンドを立ち上げっぱなしにして、画面半分をブラウザに、もう半分をZedのエディタにする構成にすれば、拡張機能が無くても執筆体験自体はそこまで落ちませんでした。

画像のクリップボード貼り付けについても、Zedにはまだ組み込み機能が無く、同様に要望Issueが上がっている段階です。こちらは今のところ手動で `images/` フォルダに配置する運用にしています。

## おわりに

Zedへの移行は「VS Codeと似たエディタへの乗り換え」ではなく、「VS Code拡張というエコシステム前提の執筆環境を、一から作り直す作業」だと実感しました。特に、公開停止された拡張を自作フォークで延命していたつもりが、エディタが変わった瞬間に無意味になったのは想定外でした。

とはいえ `zenn-cli` 自体はエディタ非依存なので、プレビューや記事作成コマンドは変わらず使えます。ネスト表示や画像貼り付けなど、Zed側の機能追加を待つしかない部分は残っていますが、それも含めて現状を記録しておくことが、同じ移行を考えている誰かの参考になればと思います。

---

## 株式会社ONE WEDGE
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/

---
title: "[Windows] ドスパラPC（DGP-WNB1301）に antiX を入れるまでの記録"
emoji: "🏚️"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["antiX", "Linux", "32bitUEFI", "M1Mac", "balenaEtcher"]
published: true
---

![](/images/Zenn_antiX/Zenn_antiX_top.png)


## はじめに
 
Windows 10 のサポート終了しました。手元のデバイスを有効活用したいため、ドスパラPC（DGP-WNB1301）に antiX を導入しました。本書では、実際に発生したつまずきを踏まえて整理したOS導入手順をまとめています。

![](/images/Zenn_antiX/antix_desktop.jpg)

## 対象者

* DGP-WNB1301（Atom 系）の Linux 化でハマっている人
* 「64bit 版 OS を書き込んだのに USB ブートできない」と悩んでいる人
* メモリの低い PC を SSH 端末や軽量クライアントとして再利用したい人

## 前提

### 全体の流れ
  * M1 Mac で Live USB (32bit) 作成 → EFI Shell での検証 → nomodeset 回避 → インストール完了 → 最適化

### 要点

  * **i386（32bit版）の ISO** を使用する（IA32 ローダーが含まれているため）
  * BIOS で Secure Boot を Off にし、USB ブートを最優先にする
  * 起動時に画面が固まる場合は **nomodeset** を付与する
  * メモリ 2GB のため、インストール後は **zRAM** の調整推奨

### 使用環境

* 本体: Diginnos DGP-WNB1301（Atom Z3735F / メモリ 2GB）
* ファームウェア: UEFI 2.4 (IA32)
* 作成用 PC: M1 MacBook Pro (macOS)
* LiveUSB作成ツール: balenaEtcher (macOS用)
* OS イメージ: antiX-23.2_i386-base.iso

---

## 【手順①】M1 Mac で antiX の Live USB を作成する

M1 Mac 環境では、安全にOSを書き込める balenaEtcher を使用しました。

1. antiX 公式サイトから **i386 (32bit)** 版の ISO イメージをダウンロード
2. balenaEtcher を起動し、Flash from file でダウンロードした ISO を選択
3. USB メモリを挿して Select target で指定
4. Flash! を押して書き込み。完了後の「読み取れないディスク」警告は無視して取り出す

:::message
**なぜ 32bit 版か**
CPU は 64bit 対応ですが、UEFI が 32bit (IA32) の場合、標準の 64bit ローダー (`BOOTX64.EFI`) は認識されません。i386 版には起動に必要な `BOOTia32.efi` が含まれているため、こちらを選択します。（私はこれに気づかず数時間悩みました）
:::

## 【手順②】最初の壁：EFI Shell で Image type 不適合

### 1. 現象の確認
手動で `Built-in EFI Shell` を起動し、USB (fs3 など) のローダーを直接叩こうとするとエラーが発生します。

```bash
# EFI Shell での試行例
fs0:
EFI\BOOT\BOOTX64.EFI
```

### 2. エラー内容
`Image type X64 is not supported by this IA32 shell`

このエラーは、32bit UEFI であることの証拠となります。この「IA32」に対応させるには、32bit 用のブートローダーが必要になります。

## 【手順③】第2の壁：起動時のブラックアウトと nomodeset

i386 版の antiX を用意し、ようやくブートローダーの起動には成功したものの、起動途中の `run live scripts` の後に画面がブラックアウト（フリーズ）してしまいました。

### 解決策
1.  antiX ブートメニューで「詳細オプション (Advanced Options)」を選択
2.  「フェイルセーフ・オプション」等から **`nomodeset`** を有効化して起動
3.  これにより標準グラフィックドライバでデスクトップ表示に成功

:::message
**注意事項**
`nomodeset` を設定することで、Bay Trail / Cherry Trail 世代の Atom プロセッサでは、グラフィックチップの相性でこのように画面が映らなくなることが多々あります。
:::

## 【手順④】インストール成功と最適化設定

ついにデスクトップが起動しました。メモリ使用量はわずか **162MB** という驚異の軽さでした。

### 1. インストール

![](/images/Zenn_antiX/antix_install.jpg)

デスクトップの **Install antiX** を実行し、ディスク全体（eMMC）を消去してインストールします。

### 2. zRAM の調整

![](/images/Zenn_antiX/antix_config.jpg)

メモリ 2GB を最大限活かすため、zstandard (zstd) アルゴリズムを用いた zRAM を構成します。

1. 設定ファイルを編集
   ```bash
   sudo vi /etc/default/zramswap
   ```
2. 以下の設定に変更
   ```bash
   ALGO=zstd
   PERCENT=50
   ```
3. サービスを再起動
   ```bash
   sudo service zramswap restart
   ```

---

## 注意点

* **i386 版の選択**: I32 搭載機での 64bit OS 導入は困難です。32bit 版（i386）の選択を推奨します。
* **USB メモリの相性**: 古い USB 2.0 個体では UEFI で認識されない事象がありました。USB 3.x の新しいメモリに替え、別の PC でブート確認してから本番機で試すと切り分けが速いです。
* (参考) 過去の記事で、Linux をインストールする手順をまとめています。あわせてご参照ください。
  
https://zenn.dev/ykbone/articles/4b6e98c870240c/
https://zenn.dev/ykbone/articles/edee1ed3479dec

## おわりに

今回の作業を通して痛感したのは、古い低スペック PC でも、32bit UEFI という仕様に気をつければ、Linux で快適な専用機として蘇らせるこができるということです。もう古くて使えない、と諦める前に、ぜひ試してみてください。
本記事が、古いPCを再活用したいと考えている方の助けになれば幸いです。

---

## 株式会社ONE WEDGE
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/

---
title: "Pythonで「freee人事労務」に自動ログインして勤怠入力を自動化する"
emoji: "🏢"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["python"]
published: false
---

## はじめに

「freee人事労務」を日常的に使用している方の中には、毎日の勤怠入力を自動化したいと考えている人もいるでしょう。本記事では、Pythonを用いて「freee人事労務」に自動ログインし、勤怠入力を自動化する方法について解説します。

## 使用する技術

- **Python**: 自動化スクリプトを作成
- **Selenium**: Webブラウザの操作を自動化
- **Chromedriver**: Chromeブラウザを制御するためのドライバ

## 準備

### 1. 必要なライブラリのインストール

以下のコマンドを実行して、必要なライブラリをインストールします。

```sh
pip install selenium webdriver-manager python-dotenv
```

### 2. ChromeDriverのセットアップ

Seleniumを使用するには、ブラウザドライバ（ChromeDriver）が必要です。
`webdriver-manager` を利用することで、手動でダウンロードせずに管理できます。

### 3. `.env` ファイルの作成

ログイン情報を `.env` ファイルに記述し、セキュリティを向上させます。

`.env` ファイル（スクリプトと同じディレクトリに作成）:

```sh:.env
FREEE_EMAIL=your_email@example.com
FREEE_PASSWORD=your_password
```

## 自動ログインと勤怠入力スクリプト

以下のスクリプトは、freee人事労務のログインページにアクセスし、ユーザー情報を入力してログイン後、勤怠入力を自動化する例です。

```python:python-auto.py
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
import sys

# .envファイルの読み込み
load_dotenv()

# 環境変数からログイン情報を取得
EMAIL = os.getenv("FREEE_EMAIL")
PASSWORD = os.getenv("FREEE_PASSWORD")

# コマンドライン引数の取得
if len(sys.argv) < 8:
    print("引数が足りません")
    sys.exit(1)

starting_time = sys.argv[1]
ending_time = sys.argv[2]
break_start = sys.argv[3]
break_end = sys.argv[4]
working_tag = sys.argv[5]
working_date = sys.argv[6]
working_memo = sys.argv[7] 

# WebDriverのセットアップ
options = Options()
options.add_argument("--headless")  # GUIなしで実行（不要なら削除）
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    # freee人事労務のログインページにアクセス
    driver.get("https://accounts.secure.freee.co.jp/login")
    time.sleep(2)
    
    # メールアドレス入力
    email_input = driver.find_element(By.NAME, "email")
    email_input.send_keys(EMAIL)
    
    # パスワード入力
    password_input = driver.find_element(By.NAME, "password")
    password_input.send_keys(PASSWORD)
    password_input.send_keys(Keys.RETURN)
    
    time.sleep(5)  # ログイン待機
    
    # 勤怠管理ページに移動
    driver.get("https://attendance.freee.co.jp/home")
    time.sleep(3)
    
    print("勤怠情報の登録処理を開始")
    
    # 指定された日付のコンテナをクリック
    date_element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, f'//td[@data-date="{working_date}"]'))
    )
    date_element.click()
    print(f"{working_date} のコンテナをクリックしました。")
    
    print("[完了]勤怠情報の登録処理")
    
except Exception as e:
    print("エラーが発生しました:", e)
    
finally:
    driver.quit()
```

## 実行方法

スクリプトを実行するには、以下のコマンドを入力します。

```sh
$ python freee-auto-registration.py 09:00 18:00 13:00 14:00 01 2025/03/01 "オフィス名"
```

## 引数の説明

1. **勤務時間-開始** (starting) → `09:00`
2. **勤務時間-終了** (ending) → `18:00`
3. **休憩時間-開始** → `13:00`
4. **休憩時間-終了** → `14:00`
5. **勤務タグ** (workingTag)
   - `01`: 出社
   - `02`: 出張
6. **追加する日付** (workingDate) → `2025/03/01`
7. **メモ** (workingMemo)
   - `"オフィス名"` (無記述の場合は `""`)

## 注意点

- 本スクリプトは自動操作を行うため、freeeの仕様変更により動作しなくなる可能性があります。
- ログイン情報は `.env` ファイルに保存し、スクリプト内に直接記述しないようにしましょう。
- `.env` ファイルを `.gitignore` に追加し、バージョン管理に含めないようにしましょう。
- `--headless` オプションを削除すると、ブラウザが開いた状態で動作します。

## まとめ

本記事では、PythonとSeleniumを用いて「freee人事労務」に自動ログインし、勤怠入力を行う方法を解説しました。毎日の作業を少しでも楽にするために、ぜひ試してみてください！

---

## 株式会社ONE WEDGE。
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/
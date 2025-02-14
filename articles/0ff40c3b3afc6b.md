---
title: "【Python】日々の「freee人事労務」の勤怠登録を自動入力する"
emoji: "🏢"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["python"]
published: true
---

## はじめに

「freee人事労務」を日常的に使用している方の中には、毎日の勤怠入力を自動化したいと考えている人もいるでしょう。本記事では、Pythonを用いて「freee人事労務」に自動ログインし、勤怠入力を自動化する方法について解説します。

::: message alert 
一般的にWebサービスをスクレイピングする場合、利用規約にスクレイピングの可否が記載されています。事前に規約を確認し、適切な方法で自動化を行ってください。
:::

## 使用する技術

- **Python**: 自動化スクリプトを作成
- **Selenium**: Webブラウザの操作を自動化
- **Chromedriver**: Chromeブラウザを制御するためのドライバ

## 準備

### 1. Python のインストール

本スクリプトを実行するためには Python が必要です。以下の公式サイトから Python をダウンロードし、インストールしてください。

🔗 [Python公式サイト](https://www.python.org/downloads/)

インストール後、ターミナルまたはコマンドプロンプトで以下のコマンドを実行し、Python が正しくインストールされているか確認します。

```sh
$ python --version
```

### 2. Chrome のインストール

本スクリプトでは Google Chrome を使用します。事前に Chrome をインストールしておいてください。


### 3. ライブラリのインストール

以下のコマンドで必要なライブラリをインストールしてください。

```sh
$ pip install selenium webdriver-manager python-dotenv
```

### 4. `.env` ファイルの作成

ログイン情報を `.env` ファイルに記述し、セキュリティを向上させます。

#### `.env` ファイル（スクリプトと同じディレクトリに作成）

```sh:.env
FREEE_EMAIL=your_email@example.com
FREEE_PASSWORD=your_password
```

## 自動ログインと勤怠入力スクリプト

以下のスクリプトは、freee人事労務のログインページにアクセスし、ユーザー情報を入力してログイン後、勤怠入力を自動化する例です。

```python:freee-auto-registration.py
from selenium import webdriver
from selenium.webdriver.support.select import Select
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from time import sleep
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import sys
import os
import traceback
from dotenv import load_dotenv

# ChromeOptionsのインスタンスを作成
chrome_options = Options()
chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])

# .envファイルの読み込み
load_dotenv()

# 要 初期設定
# Freee 人事労務
url = "https://p.secure.freee.co.jp/"
# url = "https://accounts.secure.freee.co.jp/"

# 環境変数からログイン情報を取得
EMAIL = os.getenv("FREEE_EMAIL")
PASSWORD = os.getenv("FREEE_PASSWORD")

# コマンドライン引数から取得
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

# "HH:mm" → "HH"（時）, "mm"（分）分割
starting_hour, starting_minute = starting_time.split(":")  # "09:00" → ["09", "00"]
ending_hour, ending_minute = ending_time.split(":")  # "18:00" → ["18", "00"]
break_start_hour, break_start_minute = break_start.split(":")  # "12:00" → ["12", "00"]
break_end_hour, break_end_minute = break_end.split(":")  # "13:00" → ["13", "00"]

# 勤怠タグの選択
if working_tag == "01":
    working_type = "出社"
elif working_tag == "02":
    working_type = "出張"
elif working_tag == "03":
    working_type = "出社,出張"

try:
    # ユーザーに実行確認
    val = input('[確認]勤怠登録を開始しますか' + ', y or n ?')
    if val == 'y':

        # WebDriverのセットアップ
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # freee人事労務
        driver.get(url)

        # メールアドレス入力
        email_input = driver.find_element(By.XPATH, '//*[@id="loginIdField"]')

        email_input.send_keys(EMAIL)
        
        # パスワード入力
        password_input = driver.find_element(By.XPATH, '//*[@id="passwordField"]')
        
        password_input.send_keys(PASSWORD)
        password_input.send_keys(Keys.RETURN)
        print("[完了]ログイン")

        sleep(2)
        
        # "勤怠"タブを押下
        driver.find_element(By.XPATH, '//*[@id="gn-navigation-menu"]/nav/div/ul/li[3]/a/div[1]/div[2]/span/span').click()

        sleep(2)
        print("[完了]勤怠タブ")
        sleep(3)
        
        print(f"{working_date} 分 登録開始")

        # sleep(5)
        date_xpath = f'//td[@data-date="{working_date}"]'
        date_element = driver.find_element(By.XPATH, date_xpath)
        date_element.click()
        
        # ---勤怠時間----------------------------------------
        # 勤怠時間-開始(HH)を入力
        starting_hour_input = driver.find_element(By.XPATH, '//*[@id="clock_in_hour"]')
        starting_hour_input.clear()
        starting_hour_input.send_keys(starting_hour)

        # 勤怠時間-開始(mm)を入力
        starting_minute_input = driver.find_element(By.XPATH, '//*[@id="clock_in_minute"]')
        starting_minute_input.clear()
        starting_minute_input.send_keys(starting_minute)

        # 勤務時間-終了(HH)を入力
        ending_hour_input = driver.find_elements(By.ID, "clock_in_hour")[1] 
        ending_hour_input.clear()
        ending_hour_input.send_keys(ending_hour)

        # 勤怠時間-終了(mm)を入力
        ending_minute_input = driver.find_elements(By.ID, "clock_in_minute")[1] 
        ending_minute_input.clear()
        ending_minute_input.send_keys(ending_minute)
        
        print("[完了]勤務時間："+ starting_hour + ":" + starting_minute + " ~ " + ending_hour + ":" + ending_minute) 

        # ---休憩時間----------------------------------------
        # 休憩時間-開始(HH)を入力
        break_starting_hour_input = driver.find_element(By.XPATH, '//*[@id="clock_out_hour"]')
        break_starting_hour_input.clear()
        break_starting_hour_input.send_keys(break_start_hour)

        # 休憩時間-開始(mm)を入力
        break_starting_minute_input = driver.find_element(By.XPATH, '//*[@id="clock_out_minute"]')
        break_starting_minute_input.clear()
        break_starting_minute_input.send_keys(break_start_minute)

        # 休憩時間-終了(HH)を入力
        break_ending_hour_input = driver.find_elements(By.ID, "clock_in_hour")[2] 
        break_ending_hour_input.clear()
        break_ending_hour_input.send_keys(break_end_hour)

        # 休憩時間-終了(mm)を入力
        break_ending_minute_input = driver.find_elements(By.ID, "clock_in_minute")[2] 
        break_ending_minute_input.clear()
        break_ending_minute_input.send_keys(break_end_minute)

        print("[完了]休憩時間："+ break_start_hour + ":" + break_start_minute + " ~ " + break_end_hour + ":" + break_end_minute)
        
        # ---勤怠タグ----------------------------------------
        
        # 勤怠タグ追加ボタン押下
        add_tag_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, '//button[@aria-label="追加" and @aria-controls="vb-withPopup_43__popup"]'))
        )
        add_tag_button.click()
        
        # ポップアップが表示されるまで待機
        popup = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "vb-withPopup_43__popup"))
        )
        sleep(2)
        
        # 出社・出張のチェックボックスの XPath を定義
        checkbox_xpath = ""
        if working_tag == "01":  # 出社のみ
            checkbox_xpath = '//span[contains(text(), "出社")]/preceding-sibling::input[@type="checkbox"]'
        elif working_tag == "02":  # 出張のみ
            checkbox_xpath = '//span[contains(text(), "出張")]/preceding-sibling::input[@type="checkbox"]'
        elif working_tag == "03":  # 出社と出張の両方
            checkbox_xpath = [
                '//span[contains(text(), "出社")]/preceding-sibling::input[@type="checkbox"]',
                '//span[contains(text(), "出張")]/preceding-sibling::input[@type="checkbox"]'
            ]

        # チェックボックスをクリック
        if isinstance(checkbox_xpath, list):  # 出社と出張の両方をチェックする場合
            for xpath in checkbox_xpath:
                checkbox = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, xpath))
                )
                driver.execute_script("arguments[0].click();", checkbox)  # JavaScriptでクリック
                
        else:
            checkbox = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, checkbox_xpath))
            )
            driver.execute_script("arguments[0].click();", checkbox)  # JavaScriptでクリック
            
        
        # ---勤怠メモ----------------------------------------
        memo_input = driver.find_element(By.ID, "note")
        memo_input.clear()
        memo_input.send_keys(working_memo)
        print("[完了]勤怠メモ：" + working_memo)
        
        # ---保存ボタン----------------------------------------
        save_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, '//button[contains(@class, "vb-button--appearancePrimary")]//span[contains(text(), "保存")]'))
        )
        save_button.click()
        print("[完了]勤怠登録")

        sleep(2)

        # ブラウザを閉じる
        driver.quit()

        print('[終了]')

    if val == 'n':
        print('[中止]')

except Exception as e:
    print("ERROR:", e)
    traceback.print_exc()
    
finally:
    driver.quit()

```

## 実行方法

スクリプトを実行するには、以下のコマンドを入力します。

```sh
$ python freee-auto-registration.py 09:00 18:00 12:00 13:00 01 2025/03/01 "オフィス"
```
:::message
引数が多いため、入力を簡略化できるような工夫（クリップボードのピン、ユーザー辞書やスニペットの登録、スクリプト改変など）をおすすめします。
:::

### 引数の説明

1. **勤務時間-開始** (starting_time) → `09:00`
2. **勤務時間-終了** (ending_time) → `18:00`
3. **休憩時間-開始** (break_starting_time) → `12:00`
4. **休憩時間-終了** (break_ending_time)→ `13:00`
5. **勤務タグ** (working_tag)
   - `00`: 登録なし
   - `01`: 出社
   - `02`: 出張
   - `03`: 出社+出張
6. **追加する日付** (working_date) → `2025/03/01`
7. **メモ** (working_memo)
   - `"オフィス名 など"` (無記述の場合は `""`)


:::message
**[Tips] Terminal 操作**
- `Ctrl + ← / →` ： 単語ごとにカーソルを移動でき、長いコマンドの編集時に便利
- `Ctrl + A / Ctrl + E` ： コマンドの先頭や末尾に一発で移動
- `Ctrl + U / Ctrl + K` ： カーソル位置より前後のテキストを削除
- `Ctrl + R` ： コマンド履歴を検索（過去に実行したコマンドを素早く呼び出せる）
:::

## 注意点

- 本スクリプトは自動操作を行うため、freeeの仕様変更により動作しなくなる可能性があります。
- ログイン情報は `.env` ファイルに保存し、スクリプト内に直接記述しないようにしましょう。
- `.env` ファイルを `.gitignore` に追加し、バージョン管理に含めないようにしましょう。


## おわりに

本記事では、PythonとSeleniumを用いて「freee人事労務」に自動ログインし、勤怠入力を行う方法を解説しました。
勤怠登録は毎日のルーティンですが、手作業では少々手間がかかります。このスクリプトが、その負担を軽減する一助となれば幸いです。

ただし、一番大切なのは目視で最終確認を行うことです。自動化に頼りすぎると、思わぬミスにつながる可能性がありますので特にご注意ください！

そして、勤怠管理は会社全体の運用にも関わるため、人事労務担当者に迷惑をかけないよう注意しながら適切に活用していただければ幸いです。

---

## 株式会社ONE WEDGE。
【Serverlessで世の中をもっと楽しく】
ONE WEDGEはServerlessシステム開発を中核技術としてWeb系システム開発、AWS/GCPを利用した業務システム・サービス開発、PWAを用いたモバイル開発、Alexaスキル開発など、元気と技術力を武器にお客様に真摯に向き合う価値創造企業です。
https://onewedge.co.jp/
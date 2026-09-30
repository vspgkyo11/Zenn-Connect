#!/usr/bin/env node
// Zenn 記事の「公開 → 社内記事申請フォーム送信」を一括実行するスクリプト。
//
// Usage:
//   node scripts/zenn-publish-apply.mjs list                      # 未公開(published: false)記事の一覧
//   node scripts/zenn-publish-apply.mjs login                     # Google に手動ログイン（初回のみ・プロファイルに保存）
//   node scripts/zenn-publish-apply.mjs check  --slug <slug>      # 事前チェックのみ（記事/ブランチ/フォームへのログイン状態）
//   node scripts/zenn-publish-apply.mjs run    --slug <slug> --at "2026/10/01 08:00" [options]
//
// run のオプション:
//   --slug <slug>          対象記事のスラッグ（articles/<slug>.md）
//   --title <部分一致>     スラッグの代わりにタイトルで特定（未公開記事から1件に絞れること）
//   --at "YYYY/MM/DD HH:mm" 実行日時（JST）。未来なら到来まで待機してから実行。省略時は即時
//   --category "A,B"       記事カテゴリー（カンマ区切り）。省略時は topics から推定
//   --reserve              待機せず即時に push し、Zenn の予約公開(published_at)で --at に公開させる
//   --dry-run              git は変更せず、フォームは入力までで送信しない（スクショを保存）
//   --skip-git / --skip-form  それぞれの工程を飛ばす（片方だけやり直したい時用）
//   --no-verify-url        push 後に公開URLが 200 を返すまで待つ確認を省略
//   --headed               ブラウザを表示して実行（ログインで 2 段階認証が要る時など）
//
// 設定はリポジトリ直下の .env.zenn-publish（git管理外）または環境変数で与える。
// 雛形: .env.zenn-publish.example

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT, "articles");
const LOG_DIR = join(ROOT, ".zenn-publish");

const envFile = join(ROOT, ".env.zenn-publish");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const CONFIG = {
  zennUser: process.env.ZENN_USERNAME || "ykbone",
  branch: process.env.ZENN_PUBLISH_BRANCH || "main",
  formUrl:
    process.env.FORM_URL ||
    "https://docs.google.com/forms/d/e/1FAIpQLSdMk1QZZejdMIQ01W0E0nzsK947gMlT3C4fvwwBkWmtya3L0g/viewform",
  formEmail: process.env.FORM_EMAIL || "yuichi.kobayashi@onewedge.co.jp",
  formName: process.env.FORM_NAME || "小林 勇一",
  applicationType: process.env.FORM_APPLICATION_TYPE || "新規申請",
  googleEmail: process.env.GOOGLE_ACCOUNT_EMAIL || process.env.FORM_EMAIL || "yuichi.kobayashi@onewedge.co.jp",
  googlePassword: process.env.GOOGLE_ACCOUNT_PASSWORD || "",
  profileDir: process.env.ZENN_PUBLISH_PROFILE_DIR || join(homedir(), ".zenn-publish", "chrome-profile"),
  browserChannel: process.env.ZENN_PUBLISH_BROWSER_CHANNEL ?? "chrome",
};

const CATEGORIES = [
  "最新技術トレンド",
  "チュートリアル・ハウツー",
  "プログラミング言語",
  "フロントエンド開発",
  "バックエンド開発",
  "クラウド・インフラ",
  "AI・機械学習",
  "データベース",
  "データサイエンス",
  "DevOps・CI/CD",
  "モバイルアプリ開発",
  "Web開発のベストプラクティス",
  "セキュリティ",
  "ゲーム開発",
  "キャリア",
];

// topics → 記事カテゴリーの推定表（--category 省略時に使用）
const TOPIC_CATEGORY_MAP = [
  [/^(security|cve|vulnerability|owasp|xss|csrf|auth|セキュリティ)/, "セキュリティ"],
  [/^(ai|llm|openai|chatgpt|claude|claudecode|gemini|mcp|rag|machinelearning|ml|生成ai)/, "AI・機械学習"],
  [/^(aws|gcp|azure|docker|linux|infra|terraform|cloud|kubernetes|k8s|nginx|apache|server)/, "クラウド・インフラ"],
  [/^(mysql|postgres|postgresql|prisma|database|db|sql|sqlite|redis)/, "データベース"],
  [/^(nextjs|react|vue|nuxt|css|html|frontend|tailwind|rsc)/, "フロントエンド開発"],
  [/^(laravel|php|nodejs|node|backend|api|express|livewire)/, "バックエンド開発"],
  [/^(typescript|javascript|python|go|golang|rust|java|ruby|gas)$/, "プログラミング言語"],
  [/^(githubactions|ci|cicd|devops|github)/, "DevOps・CI/CD"],
  [/^(pandas|datascience|numpy|jupyter)/, "データサイエンス"],
  [/^(flutter|ios|android|swift|kotlin|reactnative)/, "モバイルアプリ開発"],
  [/^(career|キャリア)/, "キャリア"],
];

// ───────────────────────── 共通ユーティリティ ─────────────────────────

function log(...args) {
  const ts = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${ts}]`, ...args);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, "");
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      opts[key] = true;
    } else {
      opts[key] = next;
      i++;
    }
  }
  return { command, opts };
}

// "2026/10/01 08:00" / "2026-10-01 08:00" / "2026-10-01T08:00" を JST として解釈する
function parseJst(input) {
  const m = String(input).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) fail(`日時の形式が不正です: "${input}"（例: 2026/10/01 08:00）`);
  const [, y, mo, d, h = "0", mi = "00"] = m;
  const pad = (v) => String(v).padStart(2, "0");
  const date = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${mi}:00+09:00`);
  if (Number.isNaN(date.getTime())) fail(`存在しない日時です: "${input}"`);
  return date;
}

function jstParts(date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mm: p.minute };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(target) {
  // PC のスリープ等で setTimeout がずれても良いよう、短い間隔で現在時刻を再確認する
  while (Date.now() < target.getTime()) {
    const remain = target.getTime() - Date.now();
    if (remain > 60_000) log(`⏳ 実行予定まで あと ${Math.ceil(remain / 60_000)} 分`);
    await sleep(Math.min(remain, remain > 60 * 60_000 ? 30 * 60_000 : 60_000));
  }
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

// ───────────────────────── 記事の特定 ─────────────────────────

function readFrontMatter(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = m ? m[1] : "";
  const get = (key) => {
    const line = fm.match(new RegExp(`^${key}:\\s*(.*?)\\s*(?:#.*)?$`, "m"));
    return line ? line[1].replace(/^["']|["']$/g, "") : undefined;
  };
  const topicsRaw = get("topics") || "[]";
  const topics = [...topicsRaw.matchAll(/["']?([^"',\[\]]+?)["']?\s*(?:,|\])/g)].map((x) => x[1].trim()).filter(Boolean);
  return { text, title: get("title") || "", published: get("published") === "true", topics };
}

function loadArticles() {
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const file = join(ARTICLES_DIR, f);
      return { slug, file, ...readFrontMatter(file) };
    });
}

function resolveArticle(opts) {
  const articles = loadArticles();
  if (opts.slug) {
    const a = articles.find((x) => x.slug === opts.slug);
    if (!a) fail(`articles/${opts.slug}.md が見つかりません`);
    return a;
  }
  if (opts.title) {
    const hits = articles.filter((x) => !x.published && x.title.includes(opts.title));
    if (hits.length === 0) fail(`タイトルに "${opts.title}" を含む未公開記事がありません`);
    if (hits.length > 1) fail(`候補が複数あります。--slug で指定してください:\n${hits.map((h) => `  - ${h.slug}  ${h.title}`).join("\n")}`);
    return hits[0];
  }
  fail("--slug または --title を指定してください（候補は `list` で確認）");
}

const articleUrl = (slug) => `https://zenn.dev/${CONFIG.zennUser}/articles/${slug}`;

function resolveCategories(opts, article) {
  if (opts.category) {
    const list = String(opts.category).split(/[,、]/).map((s) => s.trim()).filter(Boolean);
    const unknown = list.filter((c) => !CATEGORIES.includes(c));
    if (unknown.length) fail(`未知のカテゴリー: ${unknown.join(", ")}\n選択肢: ${CATEGORIES.join(" / ")}`);
    return list;
  }
  const found = new Set();
  for (const t of article.topics.map((x) => x.toLowerCase().replace(/[\s.\-_]/g, ""))) {
    for (const [re, cat] of TOPIC_CATEGORY_MAP) if (re.test(t)) found.add(cat);
  }
  if (found.size === 0) fail(`topics (${article.topics.join(", ")}) からカテゴリーを推定できません。--category で指定してください`);
  return [...found];
}

// ───────────────────────── git: 公開フラグ変更 → commit → push ─────────────────────────

function preflightGit() {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== CONFIG.branch) fail(`現在のブランチが ${branch} です。${CONFIG.branch} に切り替えてから実行してください`);
}

async function publishArticle(article, { publishedAt, dryRun }) {
  preflightGit();
  log(`🔄 git pull --ff-only origin ${CONFIG.branch}`);
  if (!dryRun) git("pull", "--ff-only", "origin", CONFIG.branch);

  const current = readFrontMatter(article.file);
  if (current.published && !publishedAt) {
    log(`ℹ️  ${article.slug} は既に published: true です。git 工程はスキップします`);
    return;
  }

  let text = current.text.replace(/^published:\s*\S+.*$/m, "published: true");
  if (publishedAt) {
    const { y, m, d, hh, mm } = jstParts(publishedAt);
    const line = `published_at: ${y}-${m}-${d} ${hh}:${mm}`;
    text = /^published_at:/m.test(text)
      ? text.replace(/^published_at:.*$/m, line)
      : text.replace(/^published: true$/m, `published: true\n${line}`);
  }
  if (dryRun) {
    log(`🧪 [dry-run] articles/${article.slug}.md を published: true に変更して push する予定`);
    return;
  }

  writeFileSync(article.file, text);
  const rel = `articles/${article.slug}.md`;
  git("add", rel);
  git("commit", "-m", `publish: ${article.slug}`, "--", rel);
  log(`✅ commit: publish: ${article.slug}`);

  for (let i = 0, wait = 2000; ; i++, wait *= 2) {
    try {
      git("push", "origin", CONFIG.branch);
      log(`🚀 git push origin ${CONFIG.branch} 完了`);
      return;
    } catch (e) {
      if (i >= 4) throw e;
      log(`⚠️ push 失敗。${wait / 1000}s 後に再試行 (${i + 1}/4)`);
      await sleep(wait);
    }
  }
}

async function waitForPublicUrl(url, timeoutMs = 10 * 60_000) {
  log(`🌐 公開URLの反映を待機: ${url}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      if (res.ok) {
        log("✅ 公開URLが 200 を返しました");
        return true;
      }
    } catch {}
    await sleep(20_000);
  }
  log("⚠️ 公開URLの反映を確認できませんでした（フォーム送信は続行します）");
  return false;
}

// ───────────────────────── Google Form ─────────────────────────

async function openBrowser({ headed }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    fail("playwright が見つかりません。`npm install` を実行してください");
  }
  mkdirSync(CONFIG.profileDir, { recursive: true });
  const base = {
    headless: !headed,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 1000 },
    args: ["--disable-blink-features=AutomationControlled"],
  };
  // Google ログインは素の Chromium だと弾かれやすいため、インストール済み Chrome を優先する
  if (CONFIG.browserChannel) {
    try {
      return await chromium.launchPersistentContext(CONFIG.profileDir, { ...base, channel: CONFIG.browserChannel });
    } catch (e) {
      log(`⚠️ channel=${CONFIG.browserChannel} で起動できないため同梱 Chromium を使用します (${e.message.split("\n")[0]})`);
    }
  }
  return chromium.launchPersistentContext(CONFIG.profileDir, base);
}

async function screenshot(page, name) {
  mkdirSync(LOG_DIR, { recursive: true });
  const file = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log(`📸 ${file}`);
  return file;
}

// フォームを開き、未ログインなら（パスワードが設定されていれば）自動ログインを試みる
async function openForm(page, { headed }) {
  await page.goto(CONFIG.formUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("accounts.google.com")) {
    if (!CONFIG.googlePassword) {
      throw new Error(
        "Google 未ログインです。先に `node scripts/zenn-publish-apply.mjs login` で手動ログインするか、" +
          "GOOGLE_ACCOUNT_PASSWORD を設定してください"
      );
    }
    log(`🔐 ${CONFIG.googleEmail} で Google ログインを試みます`);
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(CONFIG.googleEmail);
      await page.locator("#identifierNext").click();
    } else {
      // アカウント選択画面
      await page.getByText(CONFIG.googleEmail).first().click();
    }
    const pw = page.locator('input[type="password"]:visible');
    await pw.waitFor({ timeout: 30_000 });
    await pw.fill(CONFIG.googlePassword);
    await page.locator("#passwordNext").click();
    // 2 段階認証などは --headed なら手で通せるよう長めに待つ
    await page.waitForURL(/docs\.google\.com\/forms/, { timeout: headed ? 180_000 : 60_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  if (!(await page.locator('div[role="listitem"]').first().isVisible().catch(() => false))) {
    throw new Error(`フォームを表示できませんでした (url: ${page.url()})`);
  }
  const body = await page.locator("body").innerText();
  if (body.includes("@") && !body.includes(CONFIG.formEmail)) {
    log(`⚠️ フォーム上に ${CONFIG.formEmail} が見当たりません。別アカウントでログインしている可能性があります`);
  }
}

// 同じ見出し文言の説明ブロックと取り違えないよう、入力要素を持つ質問を優先する
async function question(page, label) {
  const items = page
    .locator('div[role="listitem"]')
    .filter({ has: page.locator('[role="heading"]', { hasText: label }) });
  const withInput = items.filter({
    has: page.locator('input, textarea, [role="radio"], [role="checkbox"], [role="listbox"]'),
  });
  return (await withInput.count()) ? withInput.first() : items.first();
}

async function fillText(q, value) {
  await q.locator('input[type="text"], input[type="url"], input[type="email"], textarea').first().fill(value);
}

async function fillDate(q, date) {
  const { y, m, d, hh, mm } = jstParts(date);
  const dateInput = q.locator('input[type="date"]');
  if (await dateInput.count()) {
    await dateInput.first().fill(`${y}-${m}-${d}`);
  } else {
    await fillText(q, `${y}/${m}/${d}`);
  }
  // 「日付＋時刻」形式の質問なら時・分も入れる
  const hour = q.locator('input[aria-label="時"], input[aria-label="Hour"]');
  const minute = q.locator('input[aria-label="分"], input[aria-label="Minute"]');
  if (await hour.count()) await hour.first().fill(hh);
  if (await minute.count()) await minute.first().fill(mm);
}

// Google Forms はクリック後に aria-checked が非同期で切り替わるため、少し待って確認する
async function isChecked(el, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  do {
    if ((await el.getAttribute("aria-checked")) === "true") return true;
    await sleep(150);
  } while (Date.now() < deadline);
  return false;
}

async function check(el, fallbackClick) {
  if ((await el.getAttribute("aria-checked")) === "true") return true;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click();
  if (await isChecked(el)) return true;
  // 要素自体のクリックが効かない場合はラベル文言側をクリックする
  if (fallbackClick) {
    await fallbackClick().catch(() => {});
    if (await isChecked(el)) return true;
  }
  return false;
}

// 選択肢の探し方は複数ある（data-value / aria-label / aria-labelledby 経由の名前 / 文言）ので順に試す
async function findOption(q, value) {
  const roles = ["radio", "checkbox"];
  const candidates = [
    q.locator(roles.map((r) => `[role="${r}"][data-value="${value}"], [role="${r}"][data-answer-value="${value}"], [role="${r}"][aria-label="${value}"]`).join(", ")),
    ...roles.map((r) => q.getByRole(r, { name: value, exact: true })),
    ...roles.map((r) => q.getByRole(r, { name: value })),
    // 文言を含み、かつ選択肢を内包する最も内側の要素（DOM順で最後に来る祖先）の中の選択肢
    q.locator("label, div, span").filter({ hasText: value }).filter({ has: q.page().locator('[role="radio"], [role="checkbox"]') }).last().locator('[role="radio"], [role="checkbox"]'),
  ];
  for (const c of candidates) if (await c.count()) return c.first();
  return null;
}

async function describeOptions(q) {
  const opts = await q.locator('[role="radio"], [role="checkbox"], [role="option"]').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute("role")}:${e.getAttribute("aria-label") || e.getAttribute("data-value") || e.getAttribute("data-answer-value") || e.textContent.trim()}`)
  );
  const text = (await q.innerText()).replace(/\s+/g, " ").slice(0, 400);
  return `\n  検出した選択肢: ${opts.join(" | ") || "(なし)"}\n  質問欄の文言: ${text}`;
}

async function choose(q, role, value) {
  // プルダウン形式の質問
  const listbox = q.locator('[role="listbox"]');
  if (!(await findOption(q, value)) && (await listbox.count())) {
    await listbox.first().click();
    const page = q.page();
    await page.locator(`[role="option"][data-value="${value}"]`).last().click();
    await sleep(500);
    if ((await listbox.first().innerText()).includes(value)) return;
    throw new Error(`プルダウンで「${value}」を選択できませんでした${await describeOptions(q)}`);
  }
  const opt = await findOption(q, value);
  if (!opt) throw new Error(`選択肢「${value}」が見つかりません${await describeOptions(q)}`);
  const ok = await check(opt, () => q.getByText(value, { exact: true }).first().click());
  if (!ok) throw new Error(`「${value}」を選択できませんでした${await describeOptions(q)}`);
}

async function enableCopyToSelf(page) {
  let cb = page.locator('[role="checkbox"][aria-label*="回答のコピー"], [role="switch"][aria-label*="回答のコピー"]').first();
  if (!(await cb.count())) {
    // aria-label が無い場合は、文言を含む最も近い祖先要素の中のチェックボックスを探す
    const label = page.getByText("回答のコピーを自分宛に送信する").first();
    if (!(await label.count())) return false;
    cb = label.locator('xpath=ancestor::*[.//*[@role="checkbox" or @role="switch"]][1]').locator('[role="checkbox"], [role="switch"]').first();
    if (!(await cb.count())) return false;
  }
  return check(cb, () => page.getByText("回答のコピーを自分宛に送信する").first().click());
}

async function submitForm({ article, url, postDate, categories, dryRun, headed }) {
  const context = await openBrowser({ headed });
  const page = context.pages()[0] || (await context.newPage());
  try {
    await openForm(page, { headed });
    log("📝 フォーム入力を開始");

    const fields = [
      ["メールアドレス", async (q) => {
        const input = q.locator('input[type="email"], input[type="text"]');
        if (await input.count()) await input.first().fill(CONFIG.formEmail);
      }],
      ["申請種別", (q) => choose(q, "radio", CONFIG.applicationType)],
      ["氏名", (q) => fillText(q, CONFIG.formName)],
      ["投稿日", (q) => fillDate(q, postDate)],
      ["記事のタイトル", (q) => fillText(q, article.title)],
      ["記事URL", (q) => fillText(q, url)],
      ["記事カテゴリー", async (q) => {
        for (const c of categories) await choose(q, "checkbox", c);
      }],
    ];
    const done = new Set();
    let copyEnabled = false;

    // 複数ページ構成のフォームにも対応：各ページで見つかった質問を埋め、「次へ」で進む
    for (let pageNo = 1; pageNo <= 10; pageNo++) {
      for (const [label, fill] of fields) {
        if (done.has(label)) continue;
        const q = await question(page, label);
        if (!(await q.count())) continue;
        await fill(q);
        done.add(label);
        log(`  ✔ ${label}`);
      }
      copyEnabled ||= await enableCopyToSelf(page);

      const next = page.locator('[role="button"]').filter({ hasText: /^次へ$|^Next$/ });
      if (await next.count()) {
        await next.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
        continue;
      }
      break;
    }

    const missing = fields.map(([l]) => l).filter((l) => l !== "メールアドレス" && !done.has(l));
    if (missing.length) throw new Error(`フォーム上で見つからなかった項目: ${missing.join(", ")}`);
    if (!copyEnabled) throw new Error("「回答のコピーを自分宛に送信する」をオンにできませんでした");
    log("  ✔ 回答のコピーを自分宛に送信する: ON");

    await screenshot(page, `${article.slug}-filled`);
    if (dryRun) {
      log("🧪 [dry-run] 送信はしていません。スクリーンショットで入力内容を確認してください");
      return;
    }

    await page.locator('[role="button"]').filter({ hasText: /^送信$|^Submit$/ }).first().click();
    await page.waitForURL(/formResponse/, { timeout: 30_000 }).catch(() => {});
    const body = await page.locator("body").innerText();
    await screenshot(page, `${article.slug}-submitted`);
    if (!/回答を記録しました|response has been recorded/i.test(body) && !page.url().includes("formResponse")) {
      throw new Error("送信完了画面を確認できませんでした。スクリーンショットを確認してください");
    }
    log(`✅ フォーム送信完了（控えメールが ${CONFIG.formEmail} に届くので確認してください）`);
  } catch (e) {
    await screenshot(page, `${article.slug}-error`);
    throw e;
  } finally {
    await context.close();
  }
}

async function checkFormAccess({ headed }) {
  const context = await openBrowser({ headed });
  const page = context.pages()[0] || (await context.newPage());
  try {
    await openForm(page, { headed });
    log("✅ フォームにアクセスできます（ログイン済み）");
  } finally {
    await context.close();
  }
}

// ───────────────────────── コマンド ─────────────────────────

function cmdList() {
  const drafts = loadArticles().filter((a) => !a.published);
  console.log(`未公開記事 ${drafts.length} 件:`);
  for (const a of drafts) console.log(`  ${a.slug.padEnd(48)} ${a.title}`);
}

async function cmdLogin() {
  log(`ブラウザで ${CONFIG.googleEmail} にログインしてください。フォームが表示されたらウィンドウを閉じると完了です`);
  const context = await openBrowser({ headed: true });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(CONFIG.formUrl);
  await new Promise((r) => context.on("close", r));
  log(`✅ ログイン情報を保存しました: ${CONFIG.profileDir}`);
}

function summarize({ article, url, runAt, categories, opts }) {
  const { y, m, d, hh, mm } = jstParts(runAt);
  console.log(
    [
      "──────── 実行内容 ────────",
      `記事        : ${article.slug}`,
      `タイトル    : ${article.title}`,
      `公開URL     : ${url}`,
      `実行日時    : ${y}/${m}/${d} ${hh}:${mm} (JST)${opts.reserve ? "  ※Zenn予約公開(published_at)を使用" : ""}`,
      `申請種別    : ${CONFIG.applicationType}`,
      `氏名/メール : ${CONFIG.formName} / ${CONFIG.formEmail}`,
      `カテゴリー  : ${categories.join(", ")}`,
      `工程        : ${opts["skip-git"] ? "" : "git公開 "}${opts["skip-form"] ? "" : "フォーム送信"}${opts["dry-run"] ? " (dry-run)" : ""}`,
      "──────────────────────────",
    ].join("\n")
  );
}

async function cmdRun(opts, { checkOnly = false } = {}) {
  const article = resolveArticle(opts);
  const url = articleUrl(article.slug);
  const runAt = opts.at ? parseJst(opts.at) : new Date();
  const categories = resolveCategories(opts, article);
  const headed = Boolean(opts.headed);
  const dryRun = Boolean(opts["dry-run"]);
  summarize({ article, url, runAt, categories, opts });

  // 待機に入る前に、落ちる要因を先に潰しておく
  if (!opts["skip-git"]) {
    preflightGit();
    if (article.published && !opts.reserve) log(`ℹ️  ${article.slug} は既に公開済みです`);
  }
  if (!opts["skip-form"]) await checkFormAccess({ headed });
  if (checkOnly) return;

  if (opts.reserve) {
    if (!opts["skip-git"]) await publishArticle(article, { publishedAt: runAt, dryRun });
  } else {
    if (runAt > new Date()) await waitUntil(runAt);
    log("▶️  実行開始");
    if (!opts["skip-git"]) {
      await publishArticle(article, { dryRun });
      if (!dryRun && !opts["no-verify-url"]) await waitForPublicUrl(url);
    }
  }
  if (!opts["skip-form"]) {
    await submitForm({ article, url, postDate: runAt, categories, dryRun, headed });
  }
  log("🎉 すべての工程が完了しました");
}

const { command, opts } = parseArgs(process.argv.slice(2));
try {
  switch (command) {
    case "list":
      cmdList();
      break;
    case "login":
      await cmdLogin();
      break;
    case "check":
      await cmdRun(opts, { checkOnly: true });
      break;
    case "run":
      await cmdRun(opts);
      break;
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 22).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  }
} catch (e) {
  fail(e.message);
}

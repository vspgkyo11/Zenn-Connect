#!/usr/bin/env node
// slugの命名規則を強制しつつ記事を新規作成するラッパ。
// Usage:
//   node scripts/new-article.mjs --slug laravel-queue-retry --title "..." --type tech --emoji 🔁
//
// やること:
//   1. slugのバリデーション（Zennの制約: 12〜50字 / a-z0-9-_ のみ）
//   2. articles/ 内の重複チェック（公開後は変更不可＝事故ると致命的なので事前に弾く）
//   3. ドメインprefixの妥当性チェック（既知ドメインでなければ警告）
//   4. front matter付きで articles/{slug}.md を生成

import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ARTICLES_DIR = "articles";
// プロジェクトで運用する「技術ドメイン」の許可リスト
const KNOWN_DOMAINS = ["laravel", "php", "nextjs", "react", "ts", "zenn", "infra", "ai"];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) out[key] = argv[i + 1];
  }
  return out;
}

const { slug, title, type = "tech", emoji = "📝" } = parseArgs(process.argv.slice(2));
const errors = [];
const warnings = [];

// 1. slugバリデーション
if (!slug) {
  errors.push("--slug は必須です");
} else {
  if (!/^[a-z0-9_-]+$/.test(slug)) errors.push(`slugに使えない文字: "${slug}"（a-z 0-9 - _ のみ）`);
  if (slug.length < 12 || slug.length > 50) errors.push(`slug長は12〜50字（現在 ${slug.length}字）`);
}
if (!title) errors.push("--title は必須です");
if (!["tech", "idea"].includes(type)) errors.push(`typeは tech / idea のみ（指定: ${type}）`);

// 2. 重複チェック
if (slug && existsSync(join(ARTICLES_DIR, `${slug}.md`))) {
  errors.push(`slug重複: ${slug}.md は既に存在します`);
}

// 3. ドメインprefixチェック
if (slug && !errors.length) {
  const domain = slug.split("-")[0];
  if (!KNOWN_DOMAINS.includes(domain)) {
    const existing = [...new Set(
      readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md")).map((f) => f.split("-")[0])
    )].sort();
    warnings.push(`prefix "${domain}" は未知のドメインです。既知: ${KNOWN_DOMAINS.join(", ")} / 使用中: ${existing.join(", ")}`);
  }
}

if (errors.length) {
  console.error("❌ 作成中止:");
  for (const e of errors) console.error("   - " + e);
  process.exit(1);
}
for (const w of warnings) console.warn("⚠️  " + w);

// 4. ファイル生成
const now = new Date().toISOString().slice(0, 16).replace("T", " ");
const content = `---
title: "${title}"
emoji: "${emoji}"
type: "${type}"
topics: []
published: false
---

<!-- 下書き。published_at は公開時に設定: ${now} -->
`;
const path = join(ARTICLES_DIR, `${slug}.md`);
writeFileSync(path, content);
console.log(`✅ 作成: ${path}`);

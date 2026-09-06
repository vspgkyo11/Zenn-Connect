#!/usr/bin/env node
// articles/ を舐めて front matter を集計・一覧化する（依存ゼロ）
// Usage:
//   node scripts/list-articles.mjs                    グループ表示
//   node scripts/list-articles.mjs --json             JSON出力
//   node scripts/list-articles.mjs --domain laravel   ドメイン絞り込み

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ARTICLES_DIR = "articles";

// --- 最小限の front matter パーサ（Zennのfront matterに特化）---
// 完全なYAMLではなく title/emoji/type/topics/published/published_at だけを堅実に抜く。
// より複雑なYAMLを扱うなら gray-matter を使うこと。
function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const fm = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rest] = kv;
    if (key === "topics") {
      if (rest.trim().startsWith("[")) {
        // インライン配列: ["a", "b"]
        fm.topics = rest.trim().replace(/^\[|\]$/g, "")
          .split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      } else {
        // ブロック配列: 後続の "- xxx" 行を集める
        const arr = [];
        let j = i + 1;
        while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
          arr.push(lines[j].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
          j++;
        }
        fm.topics = arr;
        i = j - 1;
      }
    } else {
      fm[key] = rest.trim().replace(/^["']|["']$/g, "");
    }
  }
  return fm;
}

// slug の第1セグメントをドメインとみなす（laravel-session-separation → laravel）
const domainOf = (slug) => slug.split("-")[0] || "(none)";

const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
const articles = files.map((f) => {
  const slug = f.replace(/\.md$/, "");
  const fm = parseFrontMatter(readFileSync(join(ARTICLES_DIR, f), "utf8")) || {};
  return {
    slug,
    domain: domainOf(slug),
    title: fm.title ?? "(no title)",
    emoji: fm.emoji ?? "",
    type: fm.type ?? "",
    topics: fm.topics ?? [],
    published: fm.published === "true" || fm.published === true,
    published_at: fm.published_at ?? "",
  };
});

// --- CLI引数 ---
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const di = args.indexOf("--domain");
const domainFilter = di >= 0 ? args[di + 1] : null;

let list = domainFilter ? articles.filter((a) => a.domain === domainFilter) : articles;

if (asJson) {
  console.log(JSON.stringify(list, null, 2));
  process.exit(0);
}

// ドメインでグルーピングして表示
const groups = {};
for (const a of list) (groups[a.domain] ??= []).push(a);

for (const d of Object.keys(groups).sort()) {
  const items = groups[d].sort((x, y) =>
    (y.published_at || "").localeCompare(x.published_at || ""));
  console.log(`\n■ ${d}  (${items.length})`);
  for (const a of items) {
    const badge = a.published ? "✅" : "📝draft";
    const date = a.published_at ? a.published_at.slice(0, 10) : "----------";
    console.log(`  ${badge}  ${date}  ${a.slug}`);
    console.log(`         ${a.emoji} ${a.title}  [${a.topics.join(", ")}]`);
  }
}

const pub = list.filter((a) => a.published).length;
console.log(`\n── 合計 ${list.length}本 / 公開 ${pub} / 下書き ${list.length - pub} / ドメイン ${Object.keys(groups).length}種`);

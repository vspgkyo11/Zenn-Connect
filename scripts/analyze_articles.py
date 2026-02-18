import os
import glob
import frontmatter
import re
import json
import sys
from collections import Counter

def normalize_topic(topic):
    """トピックの表記揺れを吸収する (小文字化など)"""
    return topic.lower().strip()

def extract_versions(content):
    """記事内の技術バージョン表記を抽出する"""
    # 例: Laravel 10, v1.2.3, PHP 8.1 など
    version_patterns = [
        r'(?:v|Ver\.?|Version\s*)(\d+(?:\.\d+)*)',  # v1.0, Ver 2.0
        r'([A-Za-z]+)\s*(\d+(?:\.\d+)+)',           # Library 1.2.3
        r'(Laravel|PHP|Node\.?js|Python|Ruby|Go)\s*(\d+)', # Major frameworks/langs
    ]
    versions = []
    for pattern in version_patterns:
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for match in matches:
            versions.append(match.group(0))
    return list(set(versions)) # 重複排除

def estimate_article_type_by_content(title, content):
    """内容から記事タイプを推定する"""
    text = (title + "\n" + content).lower()
    if any(k in text for k in ['error', 'exception', 'failed', 'エラー', '解決', 'できない', '動かない']):
        return 'troubleshooting'
    if any(k in text for k in ['vs', '比較', '違い', 'どっち', 'compare']):
        return 'comparison'
    if any(k in text for k in ['tutorial', 'how to', '手順', '入門', '始め方', 'guide']):
        return 'tutorial'
    return 'explanation'

def analyze_articles(articles_dir):
    stats = {
        "meta": {
            "total_count": 0,
            "total_chars": 0,
            "avg_chars": 0,
        },
        "articles": [], # 各記事の詳細データ
        "topics": Counter(),
        "topics_normalized": Counter(),
        "emojis": Counter(),
        "types": Counter(),
        "content_types": Counter(),
        "versions": Counter(),
        "structure": {
            "char_counts": [],
            "code_blocks": [],
            "images": []
        }
    }

    files = glob.glob(os.path.join(articles_dir, "*.md"))
    stats["meta"]["total_count"] = len(files)

    if stats["meta"]["total_count"] == 0:
        return stats

    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                post = frontmatter.load(f)
                content = post.content
                metadata = post.metadata
                title = metadata.get('title', '')
                
                # 文字数カウント (簡易版)
                text_content = re.sub(r'\s+', '', content)
                char_count = len(text_content)
                
                # 構造分析
                h2_count = len(re.findall(r'^##\s', content, re.MULTILINE))
                h3_count = len(re.findall(r'^###\s', content, re.MULTILINE))
                code_count = len(re.findall(r'^```', content, re.MULTILINE)) / 2
                
                # 画像カウント (HTMLタグ含む)
                image_count = len(re.findall(r'!\[.*?\]\(.*?\)', content))
                image_count += len(re.findall(r'<img\s+.*?>', content))

                # Topics集計
                topics = metadata.get('topics', [])
                current_article_topics = []
                if isinstance(topics, list):
                    for topic in topics:
                        stats["topics"][topic] += 1
                        norm_topic = normalize_topic(topic)
                        stats["topics_normalized"][norm_topic] += 1
                        current_article_topics.append(norm_topic)
                
                # Emoji集計
                emoji = metadata.get('emoji')
                if emoji:
                    stats["emojis"][emoji] += 1

                # 記事タイプ (meta + 推定)
                meta_type = metadata.get('type', 'tech')
                stats["types"][meta_type] += 1
                
                content_type = estimate_article_type_by_content(title, content)
                stats["content_types"][content_type] += 1

                # バージョン情報
                versions = extract_versions(content)
                for v in versions:
                    stats["versions"][v] += 1

                # 密度計算 (1000文字あたり)
                density_factor = 1000 / char_count if char_count > 0 else 0
                
                article_data = {
                    "filename": os.path.basename(file_path),
                    "title": title,
                    "chars": char_count,
                    "h2": h2_count,
                    "h3": h3_count,
                    "code_blocks": code_count,
                    "images": image_count,
                    "code_density": round(code_count * density_factor, 2),
                    "image_density": round(image_count * density_factor, 2),
                    "topics": current_article_topics,
                    "versions": versions,
                    "content_type": content_type
                }
                stats["articles"].append(article_data)
                
                stats["meta"]["total_chars"] += char_count
                stats["structure"]["char_counts"].append(char_count)
                stats["structure"]["code_blocks"].append(code_count)
                stats["structure"]["images"].append(image_count)

            except Exception as e:
                print(f"Error parsing {file_path}: {e}", file=sys.stderr)

    if stats["meta"]["total_count"] > 0:
        stats["meta"]["avg_chars"] = stats["meta"]["total_chars"] // stats["meta"]["total_count"]

    return stats

def print_markdown_stats(stats):
    """従来のMarkdown出力 (下位互換性のため残す)"""
    # 省略 (必要なら再実装するが、今回はJSON出力を主とする)
    pass

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    args = parser.parse_args()

    target_dir = "articles"
    if os.path.exists(target_dir):
        data = analyze_articles(target_dir)
        if args.json:
            print(json.dumps(data, ensure_ascii=False, indent=2, default=str))
        else:
            # 簡易表示 (デバッグ用)
            print(f"Analyzed {data['meta']['total_count']} articles.")
            print("Use --json to get full data.")
    else:
        print(f"Directory not found: {target_dir}", file=sys.stderr)

import os
import glob
import frontmatter
import re

def extract_summary(content, length=100):
    """
    記事の冒頭から要約を抽出する。
    HTMLコメント、見出し、画像などをスキップして最初のテキストを取得する。
    """
    # フロントマターは frontmatter.load で既に除去されている前提
    
    lines = content.split('\n')
    summary_text = ""
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('#'): # 見出し
            continue
        if line.startswith('!['): # 画像
            continue
        if line.startswith('<img'): # imgタグ
            continue
        if line.startswith('::: '): # メッセージブロック開始
            continue
        if line.startswith(':::'): # メッセージブロック終了
            continue
        if line.startswith('```'): # コードブロック
            continue
            
        # これら以外の行を結合
        summary_text += line + " "
        
        if len(summary_text) > length:
            break
            
    # Markdown記法の除去 (簡易版)
    summary_text = re.sub(r'!\[.*?\]\(.*?\)', '', summary_text) # 画像リンク除去
    summary_text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', summary_text) # リンク除去
    summary_text = re.sub(r'\*\*(.*?)\*\*', r'\1', summary_text) # 太字
    
    return summary_text[:length] + "..." if len(summary_text) > length else summary_text

def generate_index(articles_dir, output_file):
    files = glob.glob(os.path.join(articles_dir, "*.md"))
    files.sort(key=os.path.getmtime, reverse=True) # 新しい順
    
    header = """# 記事一覧インデックス

全記事の概要一覧です。`python3 .agents/scripts/generate_index.py` で更新できます。

| タイトル | Type | Topics | 概要 |
| --- | --- | --- | --- |
"""
    
    rows = []
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)
                
            metadata = post.metadata
            title = metadata.get('title', 'No Title')
            emoji = metadata.get('emoji', '📄')
            type_ = metadata.get('type', '-')
            topics = metadata.get('topics', [])
            published = metadata.get('published', True)
            
            if not published:
                title = f"[下書き] {title}"
            
            # 相対パス計算
            rel_path = os.path.relpath(file_path, os.path.dirname(output_file))
            
            # Topics整形
            topics_str = ", ".join([f"`{t}`" for t in topics])
            
            # 概要抽出
            summary = extract_summary(post.content)
            
            # テーブル行作成
            row = f"| {emoji} [{title}]({rel_path}) | {type_} | {topics_str} | {summary} |"
            rows.append(row)
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(header + "\n".join(rows))
    
    print(f"Generated index at {output_file} ({len(rows)} articles)")

if __name__ == "__main__":
    target_dir = "articles"
    output_path = ".agents/docs/article_index.md"
    
    if os.path.exists(target_dir):
        # ディレクトリがない場合は作成
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        generate_index(target_dir, output_path)
    else:
        print(f"Directory not found: {target_dir}")

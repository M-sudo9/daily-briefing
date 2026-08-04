#!/usr/bin/env python3
"""
每日简报生成器 - 主入口
用法: python main.py
"""
import os
import sys
from datetime import datetime
from pathlib import Path

# 将 scripts 目录加入 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from collector import collect_all, load_config
from filter import deduplicate, filter_recent, filter_by_keywords
from summarizer import Summarizer
from briefing import generate_briefing, save_briefing


def main():
    print("=" * 55)
    print(f"  Daily Briefing - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 55)

    # 加载配置
    config_dir = Path(__file__).parent.parent / "config"
    sources_cfg = load_config(str(config_dir / "sources.yaml"))
    interests_cfg = load_config(str(config_dir / "interests.yaml"))

    lookback = interests_cfg.get("lookback_hours", 8)
    max_per_domain = interests_cfg.get("max_articles_per_domain", 20)

    # Step 1: 采集
    print("\n--- [1/4] 采集 RSS ---")
    articles = collect_all(sources_cfg)
    print(f"  总计: {len(articles)} 篇")

    if not articles:
        print("\n  [!] 未采集到任何文章，退出")
        return

    # Step 2: 过滤
    print("\n--- [2/4] 过滤去重 ---")
    articles = deduplicate(articles)
    articles = filter_recent(articles, hours=lookback)
    articles = filter_by_keywords(articles, interests_cfg)
    print(f"  最终: {len(articles)} 篇")

    if not articles:
        print("\n  [!] 过滤后无文章，可能关键词未命中。退出。")
        return

    # Step 3: AI 摘要
    print("\n--- [3/4] AI 摘要 ---")
    try:
        summarizer = Summarizer()
        domain_summaries = summarizer.summarize_by_domain(
            articles, interests_cfg, max_per_domain=max_per_domain
        )
    except Exception as e:
        print(f"\n  [!] AI 摘要失败: {e}")
        print("  使用降级方案（无 AI 摘要）")
        domain_summaries = []
        for art in articles:
            for domain in art.get("matched_domains", ["综合"]):
                found = next((d for d in domain_summaries if d["name"] == domain), None)
                if not found:
                    found = {"name": domain, "summary": "", "items": []}
                    domain_summaries.append(found)
                found["items"].append(
                    {
                        "title": art["title"],
                        "summary": art["summary"][:150],
                        "importance": "medium",
                        "source": art["source"],
                        "link": art["link"],
                        "published": art["published"],
                    }
                )

    # Step 4: 生成简报
    print("\n--- [4/4] 生成简报 ---")
    briefing = generate_briefing(domain_summaries, articles)

    output_dir = Path(__file__).parent.parent / "docs" / "data" / "briefings"
    save_briefing(briefing, output_dir)

    print("\n" + "=" * 55)
    print(f"  Done! ID: {briefing['id']}")
    print(f"  摘要: {len(briefing['domains'])} 领域, "
          f"{briefing['stats']['total_items']} 条")
    print("=" * 55)


if __name__ == "__main__":
    main()

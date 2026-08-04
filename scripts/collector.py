#!/usr/bin/env python3
"""RSS 源采集器 - 从各平台抓取最新内容"""
import feedparser
import yaml
import hashlib
import time
import requests
from datetime import datetime
from typing import List, Dict
from bs4 import BeautifulSoup


def load_config(config_path: str) -> Dict:
    """加载 YAML 配置文件"""
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _clean_html(text: str, max_len: int = 2000) -> str:
    """去除 HTML 标签，截断长度"""
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    clean = soup.get_text(separator=" ", strip=True)
    return clean[:max_len]


def _parse_date(entry) -> datetime:
    """解析 RSS 条目的发布时间"""
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        try:
            return datetime(*parsed[:6])
        except Exception:
            pass
    return datetime.now()


def fetch_feed(url: str, source_name: str, category: str, timeout: int = 25) -> List[Dict]:
    """获取并解析单个 RSS 源"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()

        feed = feedparser.parse(resp.content)
        items = []

        for entry in feed.entries:
            title = entry.get("title", "").strip()
            if not title:
                continue

            link = entry.get("link", "")
            raw_content = ""
            if entry.get("content"):
                raw_content = entry["content"][0].get("value", "")
            elif entry.get("summary"):
                raw_content = entry["summary"]

            content = _clean_html(raw_content)
            pub_date = _parse_date(entry)

            item = {
                "title": title,
                "link": link,
                "summary": content[:500],
                "content": content,
                "published": entry.get("published", entry.get("updated", "")),
                "published_date": pub_date.isoformat(),
                "source": source_name,
                "category": category,
                "id": hashlib.md5((link or title).encode()).hexdigest(),
            }
            items.append(item)

        return items

    except Exception as e:
        print(f"    [!] {source_name}: {e}")
        return []


def _try_rsshub_with_fallbacks(path: str, source_name: str, category: str,
                                primary: str, fallbacks: List[str]) -> List[Dict]:
    """尝试用多个 RSSHub 实例获取同一个源"""
    # 先用主实例
    url = path.replace("{rsshub_base}", primary.rstrip("/"))
    items = fetch_feed(url, source_name, category)
    if items:
        return items

    # 主实例失败，依次尝试备用实例
    for fb in fallbacks:
        fb = fb.rstrip("/")
        if fb == primary.rstrip("/"):
            continue
        print(f"      -> 尝试备用实例: {fb}")
        url = path.replace("{rsshub_base}", fb)
        items = fetch_feed(url, source_name, category, timeout=20)
        if items:
            return items

    return []


def collect_all(config: Dict) -> List[Dict]:
    """采集所有配置的 RSS 源"""
    all_items = []
    rsshub_base = config.get("rsshub_base", "https://rsshub.app").rstrip("/")
    rsshub_fallbacks = config.get("rsshub_fallbacks", [])

    feeds = config.get("feeds", [])
    print(f"   共 {len(feeds)} 个信息源, {len(rsshub_fallbacks)} 个备用 RSSHub 实例")

    for i, feed_cfg in enumerate(feeds, 1):
        url_template = feed_cfg["url"]
        name = feed_cfg["name"]
        category = feed_cfg.get("category", "未分类")

        print(f"   [{i}/{len(feeds)}] {name} ...", end=" ")

        # 如果是 RSSHub 源，支持多实例回退
        if "{rsshub_base}" in url_template and rsshub_fallbacks:
            items = _try_rsshub_with_fallbacks(
                url_template, name, category, rsshub_base, rsshub_fallbacks
            )
        else:
            url = url_template.replace("{rsshub_base}", rsshub_base)
            items = fetch_feed(url, name, category)

        all_items.extend(items)
        print(f"{len(items)} 条")

        time.sleep(0.3)  # 礼貌延迟

    return all_items

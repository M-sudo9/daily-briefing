#!/usr/bin/env python3
"""文章过滤器 - 关键词匹配、去重、时间过滤"""
from typing import List, Dict
from datetime import datetime, timedelta


def deduplicate(items: List[Dict]) -> List[Dict]:
    """根据 ID 去重"""
    seen = set()
    result = []
    for item in items:
        if item["id"] not in seen:
            seen.add(item["id"])
            result.append(item)
    print(f"   去重: {len(items)} -> {len(result)}")
    return result


def filter_recent(items: List[Dict], hours: int = 8) -> List[Dict]:
    """只保留最近 N 小时的文章"""
    cutoff = datetime.now() - timedelta(hours=hours)
    result = []
    for item in items:
        try:
            pub_date = datetime.fromisoformat(item["published_date"])
            if pub_date >= cutoff:
                result.append(item)
        except (ValueError, KeyError):
            # 无法解析日期的文章保留
            result.append(item)
    print(f"   时间过滤({hours}h): {len(items)} -> {len(result)}")
    return result


def filter_by_keywords(items: List[Dict], interests_config: Dict) -> List[Dict]:
    """根据关键词过滤，并为文章打上领域标签"""
    domains = interests_config.get("domains", [])
    include_unmatched = interests_config.get("include_unmatched", False)

    if not domains:
        for item in items:
            item["matched_domains"] = ["综合"]
        return items

    result = []
    for item in items:
        text = f"{item['title']} {item['summary']}".lower()
        matched = []

        for domain in domains:
            for kw in domain.get("keywords", []):
                if kw.lower() in text:
                    if domain["name"] not in matched:
                        matched.append(domain["name"])
                    break

        if matched:
            item["matched_domains"] = matched
            result.append(item)
        elif include_unmatched:
            item["matched_domains"] = ["综合"]
            result.append(item)

    print(f"   关键词过滤: {len(items)} -> {len(result)}")
    return result

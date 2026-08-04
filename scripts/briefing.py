#!/usr/bin/env python3
"""简报生成器 - 组装最终简报数据并写入文件"""
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict


def generate_briefing(
    domain_summaries: List[Dict], all_articles: List[Dict]
) -> Dict:
    """组装完整简报"""
    now = datetime.now()
    hour = now.hour

    if 6 <= hour < 12:
        period = "上午"
    elif 12 <= hour < 18:
        period = "下午"
    elif 18 <= hour < 24:
        period = "晚间"
    else:
        period = "凌晨"

    # 统计来源
    sources = sorted(set(art.get("source", "") for art in all_articles if art.get("source")))

    # 汇总所有摘要条目
    total_items = sum(len(d.get("items", [])) for d in domain_summaries)

    return {
        "id": now.strftime("%Y-%m-%d-%H"),
        "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "period": period,
        "summary": (
            f"本期采集 {len(all_articles)} 篇文章，"
            f"来自 {len(sources)} 个信息源，"
            f"覆盖 {len(domain_summaries)} 个领域，"
            f"精选 {total_items} 条摘要"
        ),
        "domains": domain_summaries,
        "stats": {
            "total_items": total_items,
            "total_collected": len(all_articles),
            "sources": len(sources),
            "source_list": sources,
            "domains": len(domain_summaries),
        },
    }


def save_briefing(briefing: Dict, output_dir: Path):
    """保存简报到文件系统"""
    output_dir.mkdir(parents=True, exist_ok=True)
    briefing_id = briefing["id"]

    # 保存单独的简报文件
    file_path = output_dir / f"{briefing_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(briefing, f, ensure_ascii=False, indent=2)
    print(f"   简报已保存: {file_path.name}")

    # 更新 latest.json
    latest_path = output_dir / "latest.json"
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(briefing, f, ensure_ascii=False, indent=2)

    # 更新索引
    _update_index(output_dir)


def _update_index(output_dir: Path):
    """扫描所有简报文件，生成索引"""
    briefings = []

    for json_file in sorted(output_dir.glob("*.json"), reverse=True):
        if json_file.name in ("index.json", "latest.json"):
            continue
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                briefings.append(
                    {
                        "id": data["id"],
                        "datetime": data["datetime"],
                        "date": data["date"],
                        "time": data["time"],
                        "period": data["period"],
                        "summary": data["summary"],
                        "stats": data["stats"],
                    }
                )
        except Exception as e:
            print(f"   [!] 跳过 {json_file.name}: {e}")

    # 保留最近 200 份
    briefings = briefings[:200]

    index_path = output_dir / "index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({"briefings": briefings}, f, ensure_ascii=False, indent=2)
    print(f"   索引已更新: {len(briefings)} 份简报")

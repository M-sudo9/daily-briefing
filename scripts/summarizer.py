#!/usr/bin/env python3
"""AI 摘要生成器 - 支持 Gemini (免费) 和 DeepSeek (极低价)"""
import os
import json
import time
import requests
from typing import List, Dict


class Summarizer:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "gemini").lower()

        if self.provider == "gemini":
            self.api_key = os.getenv("GEMINI_API_KEY", "")
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY 未设置")
            self.model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        elif self.provider == "deepseek":
            self.api_key = os.getenv("DEEPSEEK_API_KEY", "")
            if not self.api_key:
                raise ValueError("DEEPSEEK_API_KEY 未设置")
            self.model = "deepseek-chat"
            self.base_url = "https://api.deepseek.com/v1"
        else:
            raise ValueError(f"不支持的 AI_PROVIDER: {self.provider}")

        print(f"   AI 引擎: {self.provider} ({self.model})")

    def _call_gemini(self, prompt: str, retries: int = 3) -> str:
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096},
        }
        for attempt in range(retries):
            try:
                resp = requests.post(url, json=payload, timeout=90)
                resp.raise_for_status()
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                if attempt < retries - 1:
                    wait = (attempt + 1) * 5
                    print(f"    [!] Gemini 重试({attempt+1}/{retries}): {e}")
                    time.sleep(wait)
                else:
                    raise

    def _call_deepseek(self, prompt: str, retries: int = 3) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 4096,
        }
        for attempt in range(retries):
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=90)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                if attempt < retries - 1:
                    wait = (attempt + 1) * 5
                    print(f"    [!] DeepSeek 重试({attempt+1}/{retries}): {e}")
                    time.sleep(wait)
                else:
                    raise

    def summarize(self, prompt: str) -> str:
        if self.provider == "gemini":
            return self._call_gemini(prompt)
        return self._call_deepseek(prompt)

    def summarize_by_domain(
        self, articles: List[Dict], interests_config: Dict, max_per_domain: int = 20
    ) -> List[Dict]:
        """按领域分组，逐个生成 AI 摘要"""
        # 按领域分组
        domain_articles: Dict[str, List[Dict]] = {}
        for art in articles:
            for domain in art.get("matched_domains", ["综合"]):
                domain_articles.setdefault(domain, []).append(art)

        results = []
        for domain_name, domain_items in domain_articles.items():
            print(f"   [{domain_name}] {len(domain_items)} 篇 -> AI 摘要")

            # 限制每领域文章数
            if len(domain_items) > max_per_domain:
                domain_items = domain_items[:max_per_domain]

            articles_text = self._build_articles_text(domain_items)
            prompt = self._build_prompt(domain_name, articles_text)

            try:
                response = self.summarize(prompt)
                parsed = self._parse_response(response, domain_name, domain_items)
                results.append(parsed)
                print(f"      -> {len(parsed['items'])} 条摘要")
            except Exception as e:
                print(f"      [!] 摘要失败: {e}")
                results.append(self._fallback(domain_name, domain_items))

            time.sleep(1)

        return results

    def _build_articles_text(self, articles: List[Dict]) -> str:
        lines = []
        for i, art in enumerate(articles, 1):
            lines.append(f"[{i}] 标题: {art['title']}")
            lines.append(f"    来源: {art['source']}")
            lines.append(f"    摘要: {art['summary'][:300]}")
            lines.append(f"    链接: {art['link']}")
            lines.append("")
        return "\n".join(lines)

    def _build_prompt(self, domain: str, articles_text: str) -> str:
        return f"""你是专业新闻简报编辑。根据以下「{domain}」领域的文章生成简报。

规则：
1. 筛选最重要的 5-10 条
2. 每条生成一句话摘要（不超过50字）
3. 生成领域趋势总结（2-3句话）
4. 只基于提供的文章内容，不编造
5. 严格输出 JSON，不要任何其他文字

文章：
{articles_text}

输出格式：
{{
  "domain_summary": "领域趋势总结",
  "items": [
    {{
      "title": "标题",
      "summary": "一句话摘要",
      "importance": "high/medium/low",
      "link": "链接",
      "source": "来源"
    }}
  ]
}}"""

    def _parse_response(
        self, response: str, domain_name: str, originals: List[Dict]
    ) -> Dict:
        try:
            text = response.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            data = json.loads(text.strip())

            items = []
            for item in data.get("items", []):
                # 匹配原始文章补充元数据
                original = None
                for art in originals:
                    if art["link"] == item.get("link") or art["title"] == item.get("title"):
                        original = art
                        break

                items.append(
                    {
                        "title": item.get("title", ""),
                        "summary": item.get("summary", ""),
                        "importance": item.get("importance", "medium"),
                        "source": item.get("source", original["source"] if original else ""),
                        "link": item.get("link", original["link"] if original else ""),
                        "published": original["published"] if original else "",
                    }
                )

            return {
                "name": domain_name,
                "summary": data.get("domain_summary", ""),
                "items": items,
            }
        except (json.JSONDecodeError, IndexError, KeyError) as e:
            print(f"      [!] JSON解析失败: {e}")
            return self._fallback(domain_name, originals)

    def _fallback(self, domain_name: str, articles: List[Dict]) -> Dict:
        """AI 失败时的降级方案：直接使用原始摘要"""
        return {
            "name": domain_name,
            "summary": f"本期共 {len(articles)} 篇相关文章",
            "items": [
                {
                    "title": art["title"],
                    "summary": art["summary"][:150],
                    "importance": "medium",
                    "source": art["source"],
                    "link": art["link"],
                    "published": art["published"],
                }
                for art in articles[:10]
            ],
        }

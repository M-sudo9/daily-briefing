# 📰 每日简报 - 个人信息聚合工具

自动采集微博、B站、知乎、36氪、少数派等多平台内容，AI 生成每日简报，手机随时查看。

**完全免费** | **全自动** | **手机 PWA**

---

## 工作原理

```
GitHub Actions (云端定时运行)
  ↓ 采集 RSS 源 (微博/B站/知乎/网站...)
  ↓ 关键词过滤 & 去重
  ↓ Gemini API 生成 AI 摘要 (免费额度)
  ↓ 生成简报 JSON
GitHub Pages (免费静态网站)
  ↓ 手机浏览器打开
你 → 可添加到手机桌面，像 App 一样使用
```

## 费用

| 项目 | 费用 |
|------|------|
| GitHub Actions | 免费 (公开仓库无限分钟) |
| GitHub Pages | 免费 |
| Gemini API | 免费 (1500 次/天) |
| **总计** | **0 元** |

---

## 搭建步骤 (5 分钟)

### 第 1 步：创建 GitHub 仓库

1. 注册/登录 [github.com](https://github.com)
2. 点击右上角 `+` → `New repository`
3. 仓库名填 `daily-briefing`
4. 选择 **Public** (公开仓库免费额度更多)
5. 勾选 `Add a README file`
6. 点击 `Create repository`

### 第 2 步：上传项目文件

将本项目所有文件上传到仓库：
- 可以用 `git clone` + `git push` 上传
- 或直接在 GitHub 网页上拖拽上传

目录结构：
```
daily-briefing/
├── .github/workflows/daily-briefing.yml
├── config/
│   ├── sources.yaml      ← 信息源配置
│   └── interests.yaml     ← 关键词配置
├── scripts/
│   ├── collector.py       ← RSS 采集
│   ├── filter.py          ← 过滤去重
│   ├── summarizer.py      ← AI 摘要
│   ├── briefing.py        ← 简报生成
│   └── main.py            ← 主入口
├── docs/
│   ├── index.html         ← 手机页面
│   ├── style.css
│   ├── app.js
│   ├── manifest.json
│   ├── sw.js
│   └── data/briefings/    ← 简报数据
├── requirements.txt
└── README.md
```

### 第 3 步：获取 Gemini API Key (免费)

1. 打开 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登录 Google 账号
3. 点击 `Create API key`
4. 复制生成的 Key

> 如果无法访问 Google，可使用 DeepSeek 替代（见下方 FAQ）

### 第 4 步：配置 Secrets

1. 在 GitHub 仓库页面，点击 `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. 添加：
   - Name: `GEMINI_API_KEY`
   - Value: 粘贴你的 API Key
4. 点击 `Add secret`

### 第 5 步：开启 GitHub Pages

1. 仓库 `Settings` → `Pages`
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main`，文件夹选择 `/docs`
4. 点击 `Save`
5. 等待 1-2 分钟，页面会显示你的网址：
   `https://你的用户名.github.io/daily-briefing/`

### 第 6 步：手动触发第一次运行

1. 仓库页面点击 `Actions` 标签
2. 左侧选择 `Daily Briefing`
3. 点击 `Run workflow` → `Run workflow`
4. 等待 2-3 分钟运行完成
5. 刷新你的 Pages 网址，即可看到简报！

### 第 7 步：添加到手机桌面

**iOS (iPhone)：**
1. 用 Safari 打开你的 Pages 网址
2. 点击底部分享按钮
3. 选择 `添加到主屏幕`

**Android：**
1. 用 Chrome 打开你的 Pages 网址
2. 点击菜单 (三个点)
3. 选择 `添加到主屏幕`

---

## 自定义配置

### 修改信息源

编辑 `config/sources.yaml`：

```yaml
feeds:
  - name: "36氪"
    url: "https://36kr.com/feed"
    category: "科技"

  # 添加B站UP主 (替换 UID)
  - name: "某UP主"
    url: "{rsshub_base}/bilibili/user/video/12345678"
    category: "视频"

  # 添加微博用户 (替换 UID)
  - name: "某博主"
    url: "{rsshub_base}/weibo/user/1234567890"
    category: "社交"
```

更多 RSSHub 路由：https://docs.rsshub.app/routes

### 修改关注关键词

编辑 `config/interests.yaml`：

```yaml
domains:
  - name: "我的领域"
    keywords:
      - "关键词1"
      - "关键词2"
```

### 修改更新频率

编辑 `.github/workflows/daily-briefing.yml` 中的 cron 表达式：

```yaml
schedule:
  # 格式: 分 时 日 月 周 (UTC 时间)
  # 当前: UTC+8 的 8/12/16/20/22 点
  - cron: "0 0,4,8,12,14 * * *"
  # 改为每 2 小时一次:
  # - cron: "0 */2 * * *"
```

> 注意：GitHub Actions cron 使用 UTC 时间，UTC+8 = UTC + 8

---

## FAQ

### Q: 小红书和抖音能采集吗？

很难。这两个平台反爬措施极严，目前没有稳定的免费采集方案。建议：
- 小红书：手动复制链接，后续可加手动输入功能
- 抖音：同上

### Q: GitHub Pages 在国内访问慢怎么办？

可以将前端部署到 [Vercel](https://vercel.com) (免费)：
1. 在 Vercel 导入 GitHub 仓库
2. 设置输出目录为 `docs`
3. 获得更快的访问速度

### Q: 无法访问 Google，怎么用 AI？

使用 DeepSeek 替代 (极低价，约 0.001 元/千 token)：
1. 获取 [DeepSeek API Key](https://platform.deepseek.com/api_keys)
2. 在 GitHub Secrets 添加 `DEEPSEEK_API_KEY`
3. 在 GitHub Variables 添加 `AI_PROVIDER` = `deepseek`
   (Settings → Secrets and variables → Actions → Variables)

### Q: RSSHub 访问不稳定？

可以自建 RSSHub 实例，或使用其他公共实例：
- https://docs.rsshub.app/instances

修改 `config/sources.yaml` 中的 `rsshub_base` 即可。

### Q: 简报数据存在哪？

存在 GitHub 仓库的 `docs/data/briefings/` 目录下，每次运行自动提交。保留最近 200 份。

---

## 技术栈

- **后端**: Python + feedparser + requests
- **AI**: Google Gemini 1.5 Flash (免费) / DeepSeek (备选)
- **采集**: RSSHub + 原生 RSS
- **前端**: HTML + CSS + Vanilla JS (PWA)
- **部署**: GitHub Actions + GitHub Pages
- **存储**: JSON 文件 (Git 仓库)

## License

MIT

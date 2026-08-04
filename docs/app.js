/* 每日简报 PWA - 前端逻辑 */
(function () {
  "use strict";

  // ===== State =====
  let currentBriefing = null;
  let currentDomain = "all";
  let currentView = "latest";

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===== Theme =====
  function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    $("#theme-icon").textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem("theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  // ===== Data Fetching =====
  async function fetchJSON(url) {
    const resp = await fetch(url + "?t=" + Date.now());
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }

  async function loadLatestBriefing() {
    try {
      const data = await fetchJSON("data/briefings/latest.json");
      currentBriefing = data;
      renderBriefing(data);
    } catch (e) {
      console.error("Failed to load briefing:", e);
      showError();
    }
  }

  // ===== Render Briefing =====
  function renderBriefing(briefing) {
    // Overview
    $("#briefing-period").textContent = briefing.period || "--";
    $("#briefing-datetime").textContent = briefing.datetime || "";
    $("#briefing-summary").textContent = briefing.summary || "";

    // Stats
    const stats = briefing.stats || {};
    const statsHtml = [
      stats.total_collected ? `<span>📄 ${stats.total_collected} 篇</span>` : "",
      stats.sources ? `<span>📡 ${stats.sources} 源</span>` : "",
      stats.domains ? `<span>🏷️ ${stats.domains} 领域</span>` : "",
      stats.total_items ? `<span>✨ ${stats.total_items} 摘要</span>` : "",
    ].join("");
    $("#briefing-stats").innerHTML = statsHtml;

    // Domain tabs
    const tabsContainer = $(".tabs-scroll");
    const domains = briefing.domains || [];

    let tabsHtml = `<button class="tab active" data-domain="all">全部</button>`;
    domains.forEach((d) => {
      const count = (d.items || []).length;
      tabsHtml += `<button class="tab" data-domain="${d.name}">${d.name} (${count})</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;

    // Bind tab clicks
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentDomain = tab.dataset.domain;
        renderArticles(briefing);
      });
    });

    // Articles
    currentDomain = "all";
    renderArticles(briefing);
  }

  function renderArticles(briefing) {
    const container = $("#article-list");
    const domains = briefing.domains || [];

    let html = "";
    domains.forEach((domain) => {
      if (currentDomain !== "all" && currentDomain !== domain.name) return;

      // Domain summary
      if (domain.summary) {
        html += `<div class="domain-summary"><strong>${domain.name}</strong>：${domain.summary}</div>`;
      }

      // Articles
      (domain.items || []).forEach((item) => {
        const importance = item.importance || "medium";
        const title = item.title || "无标题";
        const summary = item.summary || "";
        const source = item.source || "";
        const link = item.link || "#";

        html += `
          <div class="article-card ${importance}">
            <div class="article-title"><a href="${link}" target="_blank" rel="noopener">${title}</a></div>
            ${summary ? `<div class="article-summary">${summary}</div>` : ""}
            <div class="article-meta">
              ${source ? `<span class="article-source">${source}</span>` : ""}
              <a class="article-link" href="${link}" target="_blank" rel="noopener">查看原文 →</a>
            </div>
          </div>`;
      });
    });

    if (!html) {
      html = `<div class="empty-state"><div class="emoji">📭</div><p>暂无内容</p></div>`;
    }

    container.innerHTML = html;
  }

  function showError() {
    $("#article-list").innerHTML = `
      <div class="empty-state">
        <div class="emoji">😵</div>
        <p>简报加载失败</p>
        <p style="font-size:12px;margin-top:8px;">可能是首次部署，还没有生成简报</p>
      </div>`;
    $("#briefing-summary").textContent = "暂无简报，请等待首次自动生成";
  }

  // ===== History View =====
  async function loadHistory() {
    const container = $("#history-list");
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>加载中...</p></div>`;

    try {
      const data = await fetchJSON("data/briefings/index.json");
      const briefings = data.briefings || [];

      if (briefings.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="emoji">📚</div><p>暂无历史简报</p></div>`;
        return;
      }

      // Group by date
      const html = briefings
        .map((b) => {
          return `
            <div class="history-item" data-id="${b.id}">
              <div class="history-item-header">
                <span class="period-badge">${b.period}</span>
                <span class="history-item-title">${b.date} ${b.time}</span>
              </div>
              <div class="history-item-summary">${b.summary}</div>
              <div class="history-item-stats">
                ${b.stats ? `${b.stats.total_items || 0} 条摘要 · ${b.stats.sources || 0} 个来源` : ""}
              </div>
            </div>`;
        })
        .join("");

      container.innerHTML = html;

      // Bind click to load specific briefing
      $$(".history-item").forEach((item) => {
        item.addEventListener("click", async () => {
          const id = item.dataset.id;
          try {
            const briefing = await fetchJSON(`data/briefings/${id}.json`);
            currentBriefing = briefing;
            renderBriefing(briefing);
            switchView("latest");
          } catch (e) {
            console.error("Failed to load briefing:", e);
          }
        });
      });
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">📚</div><p>暂无历史简报</p></div>`;
    }
  }

  // ===== View Switching =====
  function switchView(view) {
    currentView = view;
    $$(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    $("#app").classList.toggle("hidden", view !== "latest");
    $("#history-view").classList.toggle("hidden", view !== "history");
    $("#about-view").classList.toggle("hidden", view !== "about");

    if (view === "history" && !$("#history-list").children.length) {
      loadHistory();
    }

    window.scrollTo(0, 0);
  }

  // ===== Refresh =====
  function refresh() {
    const btn = $("#refresh-btn span");
    btn.style.transform = "rotate(360deg)";
    btn.style.transition = "transform 0.6s";
    setTimeout(() => {
      btn.style.transform = "";
      btn.style.transition = "";
    }, 600);
    loadLatestBriefing();
  }

  // ===== Init =====
  function init() {
    initTheme();

    // Theme toggle
    $("#theme-toggle").addEventListener("click", toggleTheme);

    // Refresh
    $("#refresh-btn").addEventListener("click", refresh);

    // Bottom nav
    $$(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    // Load latest briefing
    loadLatestBriefing();

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

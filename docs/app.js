/* 每日简报 PWA - 前端逻辑 */
(function () {
  "use strict";

  // ===== State =====
  let currentBriefing = null;
  let currentDomain = "all";
  let currentView = "latest";
  let unreadOnly = false;

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===== LocalStorage Helpers =====
  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem("read_articles") || "[]")); }
    catch (e) { return new Set(); }
  }
  function saveReadSet(set) {
    localStorage.setItem("read_articles", JSON.stringify([...set]));
  }
  function isRead(link) {
    return getReadSet().has(link);
  }
  function toggleRead(link) {
    const set = getReadSet();
    if (set.has(link)) set.delete(link);
    else set.add(link);
    saveReadSet(set);
  }

  function getFavorites() {
    try { return JSON.parse(localStorage.getItem("favorite_articles") || "[]"); }
    catch (e) { return []; }
  }
  function saveFavorites(favs) {
    localStorage.setItem("favorite_articles", JSON.stringify(favs));
  }
  function isFavorite(link) {
    return getFavorites().some(f => f.link === link);
  }
  function toggleFavorite(item) {
    let favs = getFavorites();
    const idx = favs.findIndex(f => f.link === item.link);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.unshift({
      title: item.title,
      summary: item.summary || "",
      source: item.source || "",
      link: item.link,
      domain: item.domain || "",
      savedAt: new Date().toISOString()
    });
    saveFavorites(favs);
  }

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
    let shownCount = 0;
    let hiddenCount = 0;

    domains.forEach((domain) => {
      if (currentDomain !== "all" && currentDomain !== domain.name) return;

      let domainItems = [];
      (domain.items || []).forEach((item) => {
        const link = item.link || "#";
        const read = isRead(link);
        if (unreadOnly && read) {
          hiddenCount++;
          return;
        }
        domainItems.push({ ...item, read, domain: domain.name });
        shownCount++;
      });

      if (domainItems.length === 0) return;

      // Domain summary
      if (domain.summary) {
        html += `<div class="domain-summary"><strong>${domain.name}</strong>：${domain.summary}</div>`;
      }

      // Articles
      domainItems.forEach((item) => {
        const importance = item.importance || "medium";
        const title = item.title || "无标题";
        const summary = item.summary || "";
        const source = item.source || "";
        const link = item.link || "#";
        const readClass = item.read ? "read" : "";
        const starIcon = isFavorite(link) ? "★" : "☆";
        const starClass = isFavorite(link) ? "favorited" : "";
        const readIcon = item.read ? "✅" : "⬜";

        html += `
          <div class="article-card ${importance} ${readClass}" data-link="${escapeAttr(link)}">
            <div class="article-title"><a href="${link}" target="_blank" rel="noopener">${title}</a></div>
            ${summary ? `<div class="article-summary">${summary}</div>` : ""}
            <div class="article-meta">
              ${source ? `<span class="article-source">${source}</span>` : ""}
              <span class="article-domain-tag">${item.domain}</span>
              <div class="article-actions">
                <button class="action-btn read-btn" data-link="${escapeAttr(link)}" title="标记已看/未看">
                  <span>${readIcon}</span>
                </button>
                <button class="action-btn fav-btn ${starClass}" data-link="${escapeAttr(link)}" title="收藏/取消收藏">
                  <span>${starIcon}</span>
                </button>
                <a class="article-link" href="${link}" target="_blank" rel="noopener">原文 →</a>
              </div>
            </div>
          </div>`;
      });
    });

    if (!html) {
      if (hiddenCount > 0) {
        html = `<div class="empty-state"><div class="emoji">✅</div><p>全部 ${hiddenCount} 条已看完</p><p style="font-size:12px;margin-top:8px;">点右上角眼睛图标可以切换回全部</p></div>`;
      } else {
        html = `<div class="empty-state"><div class="emoji">📭</div><p>暂无内容</p></div>`;
      }
    }

    container.innerHTML = html;

    // Bind action buttons
    $$(".read-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = btn.dataset.link;
        toggleRead(link);
        renderArticles(currentBriefing);
      });
    });

    $$(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = btn.dataset.link;
        // Find the item in currentBriefing
        let item = null;
        for (const domain of (currentBriefing.domains || [])) {
          item = (domain.items || []).find(i => i.link === link);
          if (item) { item.domain = domain.name; break; }
        }
        if (item) {
          toggleFavorite(item);
          renderArticles(currentBriefing);
          updateFavoritesCount();
        }
      });
    });
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
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

  // ===== Favorites View =====
  function renderFavorites() {
    const container = $("#favorites-list");
    const favs = getFavorites();

    updateFavoritesCount();

    if (favs.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">⭐</div><p>还没有收藏</p><p style="font-size:12px;margin-top:8px;">在新闻列表中点星号即可收藏</p></div>`;
      return;
    }

    let html = "";
    favs.forEach((item) => {
      const read = isRead(item.link);
      const starIcon = "★";
      html += `
        <div class="article-card medium ${read ? "read" : ""}">
          <div class="article-title"><a href="${item.link}" target="_blank" rel="noopener">${item.title}</a></div>
          ${item.summary ? `<div class="article-summary">${item.summary}</div>` : ""}
          <div class="article-meta">
            ${item.source ? `<span class="article-source">${item.source}</span>` : ""}
            ${item.domain ? `<span class="article-domain-tag">${item.domain}</span>` : ""}
            <div class="article-actions">
              <button class="action-btn read-btn" data-link="${escapeAttr(item.link)}" title="标记已看/未看">
                <span>${read ? "✅" : "⬜"}</span>
              </button>
              <button class="action-btn fav-btn favorited" data-link="${escapeAttr(item.link)}" title="取消收藏">
                <span>${starIcon}</span>
              </button>
              <a class="article-link" href="${item.link}" target="_blank" rel="noopener">原文 →</a>
            </div>
          </div>
        </div>`;
    });

    container.innerHTML = html;

    // Bind buttons
    $$("#favorites-list .read-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRead(btn.dataset.link);
        renderFavorites();
      });
    });

    $$("#favorites-list .fav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = btn.dataset.link;
        let favs = getFavorites();
        favs = favs.filter(f => f.link !== link);
        saveFavorites(favs);
        renderFavorites();
      });
    });
  }

  function updateFavoritesCount() {
    const count = getFavorites().length;
    const el = $("#favorites-count");
    if (el) {
      el.textContent = count > 0 ? `共 ${count} 条收藏` : "";
    }
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
    $("#favorites-view").classList.toggle("hidden", view !== "favorites");

    if (view === "history" && !$("#history-list").children.length) {
      loadHistory();
    }
    if (view === "favorites") {
      renderFavorites();
    }

    window.scrollTo(0, 0);
  }

  // ===== Unread Filter =====
  function toggleUnreadOnly() {
    unreadOnly = !unreadOnly;
    const btn = $("#filter-unread-btn");
    if (unreadOnly) {
      btn.classList.add("active");
      btn.querySelector("span").textContent = "👀";
    } else {
      btn.classList.remove("active");
      btn.querySelector("span").textContent = "👁️";
    }
    if (currentBriefing) renderArticles(currentBriefing);
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

    // Unread filter
    $("#filter-unread-btn").addEventListener("click", toggleUnreadOnly);

    // Bottom nav
    $$(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    // Back buttons
    $$(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.back || "latest"));
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

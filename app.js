// ═══════════════════════════════════════════════════════
// app.js · Mystery Chat v3.2
// ES modules always run after DOM is parsed — no need for
// DOMContentLoaded. Boot order:
// 1. loadSavedTheme  (no flash)
// 2. Three.js bg
// 3. lucide.createIcons() — MUST run before initAuth
// 4. initSplashText
// 5. initAuth (wires all button events)
// 6. tryAutoLogin (async, non-blocking)
// ═══════════════════════════════════════════════════════
import { initThreeBackground, setBgIntensity } from "./three-bg.js";
import {
  initSplashText, showToast, showScreen, showModal, closeModal,
  initBottomNav, initAutoResizeTextarea,
  applyTheme, loadSavedTheme, initThemePicker,
  openSearchOverlay, closeSearchOverlay,
} from "./ui-animations.js";
import { initAuth, tryAutoLogin, logoutUser, changePassword, session } from "./auth.js";
import {
  initChat, populateProfileUI, getAvatarUrl,
} from "./chat.js";
import { GAMES, getGameUrl, STOCK_AVATARS } from "./games.js";
import { firestore } from "./firebase-config.js";
import {
  doc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ════════════════════════════════════
// BOOT  (ES modules run after DOM parsed — no DOMContentLoaded needed)
// ════════════════════════════════════
boot();

async function boot() {
  // ── 1. Theme (no flash) ──────────────────────────────
  loadSavedTheme();

  // ── 2. Three.js background ───────────────────────────
  try { initThreeBackground(0.6); } catch (e) { console.warn("[Three]", e); }

  // ── 3. Lucide icons ──────────────────────────────────
  // Must run BEFORE initAuth so button DOM is stable
  // lucide is a classic UMD script loaded before app.js
  if (window.lucide) {
    lucide.createIcons();
  } else {
    // Safety fallback: wait a tick
    await new Promise(r => setTimeout(r, 50));
    if (window.lucide) lucide.createIcons();
  }

  // ── 4. Splash text ───────────────────────────────────
  initSplashText("auth-splash");

  // ── 5. Wire all auth button events ───────────────────
  initAuth(onLoginSuccess);

  // ── 6. Global UI events ──────────────────────────────
  document.getElementById("btn-open-search")
    ?.addEventListener("click", openSearchOverlay);
  document.getElementById("btn-close-search")
    ?.addEventListener("click", closeSearchOverlay);
  document.getElementById("modal-overlay")
    ?.addEventListener("click", e => {
      if (e.target === document.getElementById("modal-overlay")) closeModal();
    });

  // ── 7. Online/offline ────────────────────────────────
  window.addEventListener("beforeunload", _setOffline);
  document.addEventListener("visibilitychange", () => {
    document.hidden ? _setOffline() : _setOnline();
  });

  // ── 8. Auto-login (async, runs in background) ────────
  //    If it works, it calls onLoginSuccess itself
  tryAutoLogin(onLoginSuccess).catch(e => console.warn("[AutoLogin]", e));

  console.info(
    "%c🔮 Mystery Chat%c v3.2",
    "color:#7c6fff;font-size:14px;font-weight:bold;font-family:monospace",
    "color:#8892b0;font-size:11px;font-family:monospace"
  );
}

// ════════════════════════════════════
// ON LOGIN SUCCESS
// ════════════════════════════════════
function onLoginSuccess(userSession) {
  // Populate all profile UI
  populateProfileUI({
    username:    userSession.username,
    displayName: userSession.displayName,
    bio:         userSession.bio       || "",
    rep:         userSession.rep       || 0,
    avatarUrl:   userSession.avatarUrl || null,
  });

  // Header splash
  initSplashText("header-splash");

  // Auto-resize textarea
  initAutoResizeTextarea("message-input");

  // Nav
  initBottomNav(onTabChange);

  // Theme picker buttons in settings
  initThemePicker();

  // Chat list + chat view
  initChat();

  // Settings buttons
  initSettings();

  // Games cards
  initGamesTab();

  // Profile tab
  initProfileTab();

  // FAB → open search
  document.getElementById("fab-new-chat")
    ?.addEventListener("click", openSearchOverlay);

  // Go to main screen
  showScreen("screen-main", "right");

  // Re-render Lucide for newly visible elements (nav icons etc.)
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 80);
}

// ════════════════════════════════════
// TAB CHANGE
// ════════════════════════════════════
function onTabChange(tab) {
  if (tab === "profile" && session.username) {
    populateProfileUI({
      username:    session.username,
      displayName: session.displayName,
      bio:         session.bio,
      rep:         session.rep,
      avatarUrl:   session.avatarUrl,
    });
  }
}

// ════════════════════════════════════
// SETTINGS
// ════════════════════════════════════
function initSettings() {
  const $ = id => document.getElementById(id);

  // ── Header info modal ──
  $("btn-header-menu")?.addEventListener("click", () => {
    showModal({
      title: "Mystery Chat v3",
      body: `
        <div style="font-family:var(--font-mono);font-size:12px;
          color:var(--text-secondary);line-height:2.2;">
          <div>👤 &nbsp;<span style="color:var(--accent)">@${session.username}</span></div>
          <div>🔮 &nbsp;Mystery Chat v3.2</div>
          <div>🛠 &nbsp;Made by <span style="color:var(--yellow)">Smashh</span></div>
          <div>⚡ &nbsp;Firebase · Three.js · GSAP</div>
          <div>🆓 &nbsp;Firestore Spark — free forever</div>
        </div>`,
      actions: [{ label: "Закрыть", className: "modal-btn--ghost" }],
    });
  });

  // ── Background intensity slider ──
  $("bg-intensity-slider")?.addEventListener("input", function () {
    setBgIntensity(parseInt(this.value) / 100);
  });

  // ── Change password ──
  $("setting-change-password")?.addEventListener("click", () => {
    showModal({
      title: "Смена пароля",
      body: `
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
            letter-spacing:.1em;text-transform:uppercase;">Старый пароль</label>
          <input type="password" id="mpw-old"  placeholder="••••••••" />
          <label style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
            letter-spacing:.1em;text-transform:uppercase;margin-top:6px;">Новый пароль</label>
          <input type="password" id="mpw-new1" placeholder="мин. 6 символов" />
          <label style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
            letter-spacing:.1em;text-transform:uppercase;margin-top:6px;">Повтори новый</label>
          <input type="password" id="mpw-new2" placeholder="••••••••" />
        </div>`,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const ok = await changePassword(
              $("mpw-old")?.value  || "",
              $("mpw-new1")?.value || "",
              $("mpw-new2")?.value || ""
            );
            if (!ok) {
              // changePassword already showed a toast — re-open modal
              setTimeout(() => $("setting-change-password")?.click(), 300);
            }
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });
    setTimeout(() => $("mpw-old")?.focus(), 200);
  });

  // ── Avatar change ──
  $("btn-change-avatar")?.addEventListener("click", openAvatarPicker);

  // ── Logout ──
  $("setting-logout")?.addEventListener("click", () => {
    showModal({
      title: "Выйти?",
      body: "Сессия будет завершена. Автовход отключится.",
      actions: [
        {
          label: "Выйти",
          className: "modal-btn--danger",
          onClick: async () => {
            await logoutUser();
            showToast("До свидания! 👋", "info");

            // Clear input fields
            ["input-username","input-password",
             "input-reg-password","input-reg-password2"]
              .forEach(id => { const e = $(id); if (e) e.value = ""; });

            // Reset to step 0
            document.querySelectorAll(".auth-step").forEach((s, i) => {
              s.style.display = i === 0 ? "block" : "none";
              if (window.gsap) gsap.set(s, { x: 0, opacity: 1 });
            });

            showScreen("screen-auth", "left");
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });
  });
}

// ════════════════════════════════════
// AVATAR PICKER
// ════════════════════════════════════
function openAvatarPicker() {
  let selectedUrl = session.avatarUrl || null;

  const stockHtml = STOCK_AVATARS.map(av => `
    <div class="avatar-stock-item${session.avatarUrl === av.url ? " selected" : ""}"
      data-url="${av.url}" title="${av.name}">
      <img src="${av.url}" alt="${av.name}" loading="lazy"
        onerror="this.src='https://minotar.net/helm/MHF_Steve/100.png'" />
    </div>`).join("");

  showModal({
    title: "Выбери аватарку",
    body: `
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
        letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">
        Стоковые скины
      </div>
      <div class="avatar-grid" id="av-grid">${stockHtml}</div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
        letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px;">
        Или вставь URL своей картинки
      </div>
      <input type="url" id="av-custom-url" placeholder="https://example.com/avatar.png"
        style="font-size:12px;"
        value="${(session.avatarUrl && !STOCK_AVATARS.some(a => a.url === session.avatarUrl))
          ? session.avatarUrl : ""}" />
      <div id="av-preview" style="margin-top:10px;text-align:center;min-height:24px;"></div>`,
    actions: [
      {
        label: "Сохранить",
        className: "modal-btn--primary",
        onClick: async () => {
          const customVal = document.getElementById("av-custom-url")?.value?.trim();
          const finalUrl  = customVal || selectedUrl;
          if (!finalUrl) { showToast("Выбери аватарку", "error"); return; }
          await _saveAvatarUrl(finalUrl);
        },
      },
      { label: "Отмена", className: "modal-btn--ghost" },
    ],
  });

  setTimeout(() => {
    document.querySelectorAll("#av-grid .avatar-stock-item").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll("#av-grid .avatar-stock-item")
          .forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");
        selectedUrl = item.dataset.url;
        const cu = document.getElementById("av-custom-url");
        if (cu) cu.value = "";
        _showAvatarPreview(selectedUrl);
      });
    });

    const cuInput = document.getElementById("av-custom-url");
    cuInput?.addEventListener("input", () => {
      const u = cuInput.value.trim();
      if (u) {
        document.querySelectorAll("#av-grid .avatar-stock-item")
          .forEach(i => i.classList.remove("selected"));
        selectedUrl = null;
        _showAvatarPreview(u);
      } else {
        const p = document.getElementById("av-preview");
        if (p) p.innerHTML = "";
      }
    });

    if (selectedUrl) _showAvatarPreview(selectedUrl);
  }, 180);
}

function _showAvatarPreview(url) {
  const prev = document.getElementById("av-preview");
  if (!prev || !url) return;
  prev.innerHTML = `
    <img src="${url}" alt="preview"
      style="width:58px;height:58px;border-radius:50%;border:2px solid var(--accent);
        object-fit:cover;image-rendering:pixelated;display:inline-block;"
      onerror="this.style.display='none'" />`;
}

async function _saveAvatarUrl(url) {
  if (!session.username || !url) return;
  try {
    await updateDoc(doc(firestore, "users", session.username), { avatarUrl: url });
    session.avatarUrl = url;

    const pi = document.getElementById("profile-avatar-img");
    if (pi) pi.src = url;

    const sa = document.getElementById("settings-avatar");
    if (sa) sa.innerHTML = `<img src="${url}"
      onerror="this.src='https://minotar.net/helm/MHF_Steve/100.png'" />`;

    showToast("Аватарка обновлена ✓", "success");
  } catch (e) {
    console.error(e);
    showToast("Ошибка сохранения", "error");
  }
}

// ════════════════════════════════════
// GAMES TAB
// ════════════════════════════════════
function initGamesTab() {
  const grid = document.getElementById("games-grid");
  if (!grid) return;
  grid.innerHTML = "";

  GAMES.forEach((game, i) => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="game-card-icon">${game.icon}</div>
      <div class="game-card-title">${game.title}</div>
      <div class="game-card-desc">${game.desc}</div>`;
    card.addEventListener("click", () => _launchGame(game));
    grid.appendChild(card);
    gsap.fromTo(card,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: .22, delay: i * .07 }
    );
  });

  document.getElementById("btn-close-game")?.addEventListener("click", () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe) iframe.src = "";
    document.getElementById("game-frame-container")?.classList.add("hidden");
    if (window._curGameUrl) {
      URL.revokeObjectURL(window._curGameUrl);
      window._curGameUrl = null;
    }
  });

  document.getElementById("btn-reload-game")?.addEventListener("click", () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe && window._curGameUrl) {
      iframe.src = "";
      setTimeout(() => { iframe.src = window._curGameUrl; }, 80);
    }
  });
}

function _launchGame(game) {
  if (window._curGameUrl) {
    URL.revokeObjectURL(window._curGameUrl);
    window._curGameUrl = null;
  }
  const url = getGameUrl(game.id);
  if (!url) return;
  window._curGameUrl = url;

  const container = document.getElementById("game-frame-container");
  const iframe    = document.getElementById("game-iframe");
  const title     = document.getElementById("game-frame-title");

  if (title)  title.textContent = `${game.icon} ${game.title}`;
  if (iframe) iframe.src = url;
  container?.classList.remove("hidden");
  gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: .22 });
}

// ════════════════════════════════════
// PROFILE TAB
// ════════════════════════════════════
function initProfileTab() {
  // Edit bio
  document.getElementById("btn-edit-bio")?.addEventListener("click", () => {
    const curText = document.getElementById("profile-bio")?.textContent || "";
    const defText = curText === "Тайна окутывает всё..." ? "" : curText;

    showModal({
      title: "О себе",
      body: `
        <textarea id="mbio" maxlength="200" rows="4"
          placeholder="Расскажи о себе..."
          style="resize:none;line-height:1.5;font-size:13px;margin-top:0;"
        >${defText.replace(/</g, "&lt;")}</textarea>
        <div id="bio-cnt"
          style="text-align:right;font-size:10px;color:var(--text-muted);
            font-family:var(--font-mono);margin-top:3px;">
          ${defText.length} / 200
        </div>`,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const newBio = document.getElementById("mbio")?.value || "";
            try {
              await updateDoc(
                doc(firestore, "users", session.username),
                { bio: newBio }
              );
              session.bio = newBio;
              const bioEl = document.getElementById("profile-bio");
              if (bioEl) bioEl.textContent = newBio || "Тайна окутывает всё...";
              showToast("Биография сохранена ✓", "success");
            } catch (e) {
              console.error(e);
              showToast("Ошибка сохранения", "error");
            }
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });

    setTimeout(() => {
      const ta  = document.getElementById("mbio");
      const cnt = document.getElementById("bio-cnt");
      if (ta && cnt) {
        ta.addEventListener("input", () => {
          cnt.textContent = `${ta.value.length} / 200`;
        });
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }, 200);
  });

  // Click avatar → picker
  document.getElementById("profile-avatar-img")
    ?.addEventListener("click", openAvatarPicker);
}

// ════════════════════════════════════
// ONLINE / OFFLINE
// ════════════════════════════════════
async function _setOffline() {
  if (!session.username) return;
  await updateDoc(doc(firestore, "users", session.username), {
    online: false, lastSeen: serverTimestamp(),
  }).catch(() => {});
}

async function _setOnline() {
  if (!session.username) return;
  await updateDoc(doc(firestore, "users", session.username), {
    online: true,
  }).catch(() => {});
}

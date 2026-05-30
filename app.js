// ═══════════════════════════════════════════════════════
// app.js · Mystery Chat v3
// Main orchestrator
// ═══════════════════════════════════════════════════════
import { initThreeBackground, setBgIntensity } from "./three-bg.js";
import {
  initSplashText, showToast, showScreen, showModal, closeModal,
  initBottomNav, initAutoResizeTextarea, switchTab,
  applyTheme, loadSavedTheme, initThemePicker,
  openSearchOverlay, closeSearchOverlay,
} from "./ui-animations.js";
import { initAuth, logoutUser, changePassword, session } from "./auth.js";
import {
  initChat, populateProfileUI, getAvatarUrl,
  openChat, openPeerProfilePanel,
} from "./chat.js";
import { GAMES, getGameUrl, STOCK_AVATARS } from "./games.js";
import { firestore } from "./firebase-config.js";
import {
  doc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ════════════════════════════════════
// BOOT
// ════════════════════════════════════
(async function boot() {
  // 1. Theme first — no flash
  loadSavedTheme();

  // 2. Three.js background
  try { initThreeBackground(0.6); } catch (e) { console.warn("[App] Three.js:", e); }

  // 3. Lucide icons
  if (window.lucide) lucide.createIcons();

  // 4. Splash on auth screen
  initSplashText("auth-splash");

  // 5. Auth (includes auto-login check)
  initAuth(onLoginSuccess);

  // 6. Search overlay
  document.getElementById("btn-open-search")?.addEventListener("click", openSearchOverlay);
  document.getElementById("btn-close-search")?.addEventListener("click", closeSearchOverlay);

  // 7. Modal overlay click-outside
  document.getElementById("modal-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  // 8. Online/offline tracking
  window.addEventListener("beforeunload", setOffline);
  document.addEventListener("visibilitychange", () => {
    document.hidden ? setOffline() : setOnline();
  });

  console.info(
    "%c🔮 Mystery Chat%c v3.0 · Smashh",
    "color:#7c6fff;font-size:14px;font-weight:bold;font-family:monospace",
    "color:#8892b0;font-size:11px;font-family:monospace"
  );
})();

// ════════════════════════════════════
// ON LOGIN SUCCESS
// ════════════════════════════════════
async function onLoginSuccess(userSession) {
  populateProfileUI({
    username:    userSession.username,
    displayName: userSession.displayName,
    bio:         userSession.bio    || "",
    rep:         userSession.rep    || 0,
    avatarUrl:   userSession.avatarUrl || null,
  });

  initSplashText("header-splash");
  initAutoResizeTextarea("message-input");
  initBottomNav(onTabChange);
  initThemePicker();
  initChat();
  initSettings();
  initGamesTab();
  initProfileTab();
  initFAB();

  showScreen("screen-main", "right");
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 100);
}

function onTabChange(tab) {
  if (tab === "profile" && session.username) {
    populateProfileUI({
      username: session.username, displayName: session.displayName,
      bio: session.bio, rep: session.rep, avatarUrl: session.avatarUrl,
    });
  }
}

// ════════════════════════════════════
// FAB → open search
// ════════════════════════════════════
function initFAB() {
  document.getElementById("fab-new-chat")?.addEventListener("click", openSearchOverlay);
}

// ════════════════════════════════════
// SETTINGS
// ════════════════════════════════════
function initSettings() {
  const $ = id => document.getElementById(id);

  // Header menu
  $("btn-header-menu")?.addEventListener("click", () => {
    showModal({
      title: "Mystery Chat v3",
      body: `<div style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);line-height:2.2;">
        <div>👤 &nbsp;<span style="color:var(--accent);">@${session.username}</span></div>
        <div>🔮 &nbsp;Mystery Chat v3.0</div>
        <div>🛠 &nbsp;Made by <span style="color:var(--yellow);">Smashh</span></div>
        <div>⚡ &nbsp;Firebase · Three.js · GSAP</div>
        <div>🆓 &nbsp;Firestore Spark (free forever)</div>
      </div>`,
      actions: [{ label: "Закрыть", className: "modal-btn--ghost" }],
    });
  });

  // Bg intensity
  $("bg-intensity-slider")?.addEventListener("input", function () {
    setBgIntensity(parseInt(this.value) / 100);
  });

  // Change password
  $("setting-change-password")?.addEventListener("click", () => {
    showModal({
      title: "Смена пароля",
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase;">
            Старый пароль</label>
          <input type="password" id="mpw-old" placeholder="••••••••" />
          <label style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase;margin-top:4px;">
            Новый пароль</label>
          <input type="password" id="mpw-new1" placeholder="мин. 6 символов" />
          <label style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase;margin-top:4px;">
            Повтори новый</label>
          <input type="password" id="mpw-new2" placeholder="••••••••" />
        </div>`,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const old  = $("mpw-old")?.value  || "";
            const new1 = $("mpw-new1")?.value || "";
            const new2 = $("mpw-new2")?.value || "";
            await changePassword(old, new1, new2);
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });
    setTimeout(() => $("mpw-old")?.focus(), 200);
  });

  // Avatar change
  $("btn-change-avatar")?.addEventListener("click", openAvatarPicker);

  // Logout
  $("setting-logout")?.addEventListener("click", () => {
    showModal({
      title: "Выйти из Mystery Chat?",
      body: "Сессия будет завершена.",
      actions: [
        {
          label: "Выйти",
          className: "modal-btn--danger",
          onClick: async () => {
            await logoutUser();
            showToast("До свидания! 👋", "info");
            // Reset auth fields
            ["input-username","input-password","input-reg-password","input-reg-password2"]
              .forEach(id => { const el = $(id); if (el) el.value = ""; });
            // Reset to step 0
            document.querySelectorAll(".auth-step").forEach((s, i) => {
              s.style.display = i === 0 ? "block" : "none";
              gsap.set(s, { x: 0, opacity: 1 });
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
// AVATAR PICKER (stock only — no Storage on free plan)
// ════════════════════════════════════
function openAvatarPicker() {
  let selectedUrl = session.avatarUrl || null;

  const stockGrid = STOCK_AVATARS.map((av, i) => `
    <div class="avatar-stock-item${session.avatarUrl === av.url ? " selected" : ""}"
      data-url="${av.url}" data-i="${i}" title="${av.name}">
      <img src="${av.url}" alt="${av.name}" loading="lazy"
        onerror="this.src='${getAvatarUrl("MHF_Steve")}'" />
    </div>`).join("");

  showModal({
    title: "Аватарка",
    body: `
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
        letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">
        10 стоковых скинов
      </div>
      <div class="avatar-grid" id="av-grid">${stockGrid}</div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
        letter-spacing:.1em;text-transform:uppercase;margin-top:12px;margin-bottom:6px;">
        Своя аватарка (URL картинки)
      </div>
      <input type="url" id="av-custom-url" placeholder="https://example.com/avatar.png"
        style="font-size:12px;" value="${session.avatarUrl && !STOCK_AVATARS.find(a=>a.url===session.avatarUrl) ? session.avatarUrl : ""}" />
      <div id="av-preview" style="margin-top:10px;text-align:center;min-height:24px;"></div>`,
    actions: [
      {
        label: "Сохранить",
        className: "modal-btn--primary",
        onClick: async () => {
          const customUrl = document.getElementById("av-custom-url")?.value?.trim();
          const finalUrl  = customUrl || selectedUrl;
          if (!finalUrl) { showToast("Выбери аватарку", "error"); return; }
          await saveAvatarUrl(finalUrl);
        },
      },
      { label: "Отмена", className: "modal-btn--ghost" },
    ],
  });

  setTimeout(() => {
    // Stock clicks
    document.querySelectorAll(".avatar-stock-item").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".avatar-stock-item").forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");
        selectedUrl = item.dataset.url;
        document.getElementById("av-custom-url").value = "";
        showPreview(selectedUrl);
      });
    });

    // Custom URL live preview
    const customInput = document.getElementById("av-custom-url");
    customInput?.addEventListener("input", () => {
      const url = customInput.value.trim();
      if (url) {
        document.querySelectorAll(".avatar-stock-item").forEach(i => i.classList.remove("selected"));
        selectedUrl = null;
        showPreview(url);
      } else {
        document.getElementById("av-preview").innerHTML = "";
      }
    });

    // Initial preview
    if (selectedUrl) showPreview(selectedUrl);
  }, 200);
}

function showPreview(url) {
  const prev = document.getElementById("av-preview");
  if (!prev) return;
  prev.innerHTML = `
    <img src="${url}"
      style="width:56px;height:56px;border-radius:50%;border:2px solid var(--accent);
        object-fit:cover;image-rendering:pixelated;display:inline-block;"
      onerror="this.style.display='none';document.getElementById('av-prev-err').style.display='block';" />
    <div id="av-prev-err" style="display:none;font-size:11px;color:var(--text-danger);font-family:var(--font-mono);margin-top:4px;">
      Не удалось загрузить
    </div>`;
}

async function saveAvatarUrl(url) {
  if (!session.username) return;
  try {
    await updateDoc(doc(firestore, "users", session.username), { avatarUrl: url });
    session.avatarUrl = url;
    // Update all avatar elements
    const pi = document.getElementById("profile-avatar-img");
    if (pi) { pi.src = url; }
    const sa = document.getElementById("settings-avatar");
    if (sa) sa.innerHTML = `<img src="${url}" onerror="this.src='${getAvatarUrl(session.username)}'" />`;
    showToast("Аватарка обновлена ✓", "success");
  } catch (e) {
    console.error(e); showToast("Ошибка сохранения", "error");
  }
}

// ════════════════════════════════════
// GAMES TAB
// ════════════════════════════════════
function initGamesTab() {
  const grid = document.getElementById("games-grid");
  if (!grid) return;
  grid.innerHTML = "";

  GAMES.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="game-card-icon">${game.icon}</div>
      <div class="game-card-title">${game.title}</div>
      <div class="game-card-desc">${game.desc}</div>`;
    card.addEventListener("click", () => launchGame(game));
    grid.appendChild(card);
    gsap.fromTo(card, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .22, delay: GAMES.indexOf(game) * .06 });
  });

  document.getElementById("btn-close-game")?.addEventListener("click", () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe) iframe.src = "";
    document.getElementById("game-frame-container")?.classList.add("hidden");
    if (window._curGameUrl) { URL.revokeObjectURL(window._curGameUrl); window._curGameUrl = null; }
  });

  document.getElementById("btn-reload-game")?.addEventListener("click", () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe && window._curGameUrl) {
      iframe.src = "";
      setTimeout(() => { iframe.src = window._curGameUrl; }, 80);
    }
  });
}

function launchGame(game) {
  if (window._curGameUrl) { URL.revokeObjectURL(window._curGameUrl); window._curGameUrl = null; }
  const url = getGameUrl(game.id);
  if (!url) return;
  window._curGameUrl = url;

  const container = document.getElementById("game-frame-container");
  const iframe    = document.getElementById("game-iframe");
  const title     = document.getElementById("game-frame-title");

  if (title) title.textContent = `${game.icon} ${game.title}`;
  if (iframe) iframe.src = url;
  container?.classList.remove("hidden");
  gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: .24 });
}

// ════════════════════════════════════
// PROFILE TAB
// ════════════════════════════════════
function initProfileTab() {
  // Edit bio
  document.getElementById("btn-edit-bio")?.addEventListener("click", () => {
    const cur = document.getElementById("profile-bio")?.textContent || "";
    const def = cur === "Тайна окутывает всё..." ? "" : cur;
    showModal({
      title: "О себе",
      body: `
        <textarea id="mbio" maxlength="200" rows="4" placeholder="Расскажи о себе..."
          style="resize:none;line-height:1.5;margin-top:0;font-size:13px;"
        >${def.replace(/</g,"&lt;")}</textarea>
        <div style="text-align:right;font-size:10px;color:var(--text-muted);
          font-family:var(--font-mono);margin-top:3px;" id="bio-cnt">${def.length} / 200</div>`,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const newBio = document.getElementById("mbio")?.value || "";
            try {
              await updateDoc(doc(firestore, "users", session.username), { bio: newBio });
              session.bio = newBio;
              const bioEl = document.getElementById("profile-bio");
              if (bioEl) bioEl.textContent = newBio || "Тайна окутывает всё...";
              showToast("Биография сохранена ✓", "success");
            } catch (e) { showToast("Ошибка сохранения", "error"); }
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });
    setTimeout(() => {
      const ta = document.getElementById("mbio");
      const cnt = document.getElementById("bio-cnt");
      if (ta && cnt) {
        ta.addEventListener("input", () => cnt.textContent = `${ta.value.length} / 200`);
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }, 200);
  });

  // Avatar click → picker
  document.getElementById("profile-avatar-img")?.addEventListener("click", openAvatarPicker);
}

// ════════════════════════════════════
// ONLINE STATUS
// ════════════════════════════════════
async function setOffline() {
  if (!session.username) return;
  try { await updateDoc(doc(firestore, "users", session.username), { online: false, lastSeen: serverTimestamp() }); } catch (_) {}
}
async function setOnline() {
  if (!session.username) return;
  try { await updateDoc(doc(firestore, "users", session.username), { online: true }); } catch (_) {}
}

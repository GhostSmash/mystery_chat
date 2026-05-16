// ═══════════════════════════════════════════════════════
// app.js · Mystery Chat v2
// Main orchestrator — wires everything together
// ═══════════════════════════════════════════════════════

import { initThreeBackground, setBgIntensity } from "./three-bg.js";
import {
  initSplashText, showToast, showScreen, showModal, closeModal,
  initBottomNav, initAutoResizeTextarea, switchTab,
  applyTheme, loadSavedTheme, initThemePicker,
  openSearchOverlay, closeSearchOverlay,
  openPeerPanel, closePeerPanel,
} from "./ui-animations.js";
import { initAuth, logoutUser, changePassword, session } from "./auth.js";
import {
  initChat, populateProfileUI, getAvatarUrl,
  openChat, openPeerProfilePanel,
} from "./chat.js";
import { GAMES, getGameUrl, STOCK_AVATARS } from "./games.js";
import { firestore, storage } from "./firebase-config.js";
import {
  doc, updateDoc, serverTimestamp, getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ══════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════
(async function boot() {
  // 1. Theme
  loadSavedTheme();

  // 2. Three.js background
  try { initThreeBackground(0.6); } catch(e) { console.warn("[App] Three.js:", e); }

  // 3. Lucide icons
  if (window.lucide) lucide.createIcons();

  // 4. Auth splash
  initSplashText("auth-splash");

  // 5. Auth flow
  initAuth(onLoginSuccess);

  // 6. Modal overlay close
  document.getElementById("modal-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  // 7. Search overlay buttons
  document.getElementById("btn-open-search")?.addEventListener("click", openSearchOverlay);
  document.getElementById("btn-close-search")?.addEventListener("click", closeSearchOverlay);

  // 8. Online/offline tracking
  window.addEventListener("beforeunload", setOffline);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setOffline();
    else setOnline();
  });

  console.info(
    "%c🔮 Mystery Chat%c v2.0 · Smashh",
    "color:#7c6fff;font-size:15px;font-weight:bold;font-family:monospace;",
    "color:#8892b0;font-size:11px;font-family:monospace;"
  );
})();

// ══════════════════════════════════════════
// ON LOGIN SUCCESS
// ══════════════════════════════════════════
async function onLoginSuccess(userSession) {
  // Populate UI
  populateProfileUI({
    username:    userSession.username,
    displayName: userSession.displayName,
    bio:         userSession.bio || "",
    rep:         userSession.rep || 0,
    avatarUrl:   userSession.avatarUrl || null,
  });

  // Init features
  initSplashText("header-splash");
  initAutoResizeTextarea("message-input");
  initBottomNav(onTabChange);
  initThemePicker();
  initChat();
  initSettings(userSession);
  initGamesTab();
  initProfileTab(userSession);
  initFAB();

  // Transition to main
  showScreen("screen-main", "right");

  // Re-run lucide
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 120);
}

function onTabChange(tab) {
  // Refresh profile stats when switching to profile tab
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

// ══════════════════════════════════════════
// FAB — open search overlay
// ══════════════════════════════════════════
function initFAB() {
  document.getElementById("fab-new-chat")?.addEventListener("click", () => {
    openSearchOverlay();
  });
}

// ══════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════
function initSettings(userSession) {
  const $ = id => document.getElementById(id);

  // ── Header menu button ──
  $("btn-header-menu")?.addEventListener("click", () => {
    showModal({
      title: "Mystery Chat",
      body: `
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);line-height:2;">
          <div>👤 &nbsp;<span style="color:var(--accent);">@${session.username}</span></div>
          <div>🔮 &nbsp;Mystery Chat v2.0</div>
          <div>🛠 &nbsp;Made by <span style="color:var(--yellow);">Smashh</span></div>
          <div>⚡ &nbsp;Firebase v10 · Three.js · GSAP</div>
        </div>`,
      actions: [{ label:"Закрыть", className:"modal-btn--ghost" }],
    });
  });

  // ── Background intensity ──
  $("bg-intensity-slider")?.addEventListener("input", function() {
    setBgIntensity(parseInt(this.value) / 100);
  });

  // ── Change password ──
  $("setting-change-password")?.addEventListener("click", () => {
    showModal({
      title: "Смена пароля",
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
              letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Старый пароль</div>
            <input type="password" id="modal-old-pw" placeholder="••••••••"
              style="width:100%;background:var(--bg-surface);border:1px solid var(--border-input);
              border-radius:8px;padding:10px 12px;color:var(--text-primary);
              font-family:var(--font-mono);font-size:13px;" />
          </div>
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
              letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Новый пароль</div>
            <input type="password" id="modal-new-pw1" placeholder="мин. 6 символов"
              style="width:100%;background:var(--bg-surface);border:1px solid var(--border-input);
              border-radius:8px;padding:10px 12px;color:var(--text-primary);
              font-family:var(--font-mono);font-size:13px;" />
          </div>
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
              letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Повтори новый пароль</div>
            <input type="password" id="modal-new-pw2" placeholder="••••••••"
              style="width:100%;background:var(--bg-surface);border:1px solid var(--border-input);
              border-radius:8px;padding:10px 12px;color:var(--text-primary);
              font-family:var(--font-mono);font-size:13px;" />
          </div>
        </div>`,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const old  = document.getElementById("modal-old-pw")?.value  || "";
            const new1 = document.getElementById("modal-new-pw1")?.value || "";
            const new2 = document.getElementById("modal-new-pw2")?.value || "";
            const ok   = await changePassword(old, new1, new2);
            if (!ok) {
              // Re-open the modal since changePassword shows its own toast
              setTimeout(() => $("setting-change-password")?.click(), 300);
            }
          },
        },
        { label:"Отмена", className:"modal-btn--ghost" },
      ],
    });
    // Auto-focus first field
    setTimeout(() => document.getElementById("modal-old-pw")?.focus(), 200);
  });

  // ── Avatar change ──
  $("btn-change-avatar")?.addEventListener("click", openAvatarPicker);

  // ── Logout ──
  $("setting-logout")?.addEventListener("click", () => {
    showModal({
      title: "Выйти?",
      body: "Ты уверен, что хочешь выйти из Mystery Chat?",
      actions: [
        {
          label: "Выйти",
          className: "modal-btn--danger",
          onClick: async () => {
            await logoutUser();
            showToast("До свидания! 👋", "info");
            // Reset all auth fields
            ["input-username","input-password","input-reg-password","input-reg-password2"]
              .forEach(id => { const el = $(id); if(el) el.value=""; });
            // Reset steps
            document.querySelectorAll(".auth-step").forEach((s,i) => {
              if (i===0) { s.style.display="block"; gsap.set(s,{x:0,opacity:1}); }
              else { s.style.display="none"; gsap.set(s,{x:0,opacity:1}); }
            });
            showScreen("screen-auth","left");
          },
        },
        { label:"Отмена", className:"modal-btn--ghost" },
      ],
    });
  });
}

// ══════════════════════════════════════════
// AVATAR PICKER
// ══════════════════════════════════════════
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

function openAvatarPicker() {
  let selectedStockUrl = null;

  const stockGrid = STOCK_AVATARS.map((av, i) => `
    <div class="avatar-stock-item" data-url="${av.url}" data-idx="${i}" title="${av.name}">
      <img src="${av.url}" alt="${av.name}" loading="lazy"
        onerror="this.src='${getAvatarUrl("MHF_Steve")}'" />
    </div>`).join("");

  showModal({
    title: "Сменить аватарку",
    body: `
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
        letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">
        Выбери стоковую
      </div>
      <div class="avatar-grid" id="modal-avatar-grid">${stockGrid}</div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
        letter-spacing:.1em;text-transform:uppercase;margin:12px 0 8px;">
        Или загрузи свою (макс. 5 МБ)
      </div>
      <button class="avatar-upload-btn" id="modal-avatar-upload-btn">
        📁 Выбрать файл с устройства
      </button>
      <div id="modal-avatar-preview" style="margin-top:10px;text-align:center;"></div>`,
    actions: [
      {
        label: "Сохранить",
        className: "modal-btn--primary",
        onClick: async () => {
          if (selectedStockUrl) {
            await saveAvatarUrl(selectedStockUrl);
          } else {
            const file = window._pendingAvatarFile;
            if (file) await uploadAvatar(file);
            delete window._pendingAvatarFile;
          }
        },
      },
      { label:"Отмена", className:"modal-btn--ghost", onClick: () => { delete window._pendingAvatarFile; } },
    ],
  });

  // Stock grid click
  setTimeout(() => {
    document.querySelectorAll(".avatar-stock-item").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".avatar-stock-item").forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");
        selectedStockUrl = item.dataset.url;
        window._pendingAvatarFile = null;
        // Preview
        const prev = document.getElementById("modal-avatar-preview");
        if (prev) prev.innerHTML = `<img src="${selectedStockUrl}" style="width:60px;height:60px;border-radius:50%;border:2px solid var(--accent);" />`;
      });
    });

    // Upload button
    document.getElementById("modal-avatar-upload-btn")?.addEventListener("click", () => {
      const fi = document.getElementById("avatar-file-input");
      if (fi) fi.click();
    });

    // File input handler
    const afi = document.getElementById("avatar-file-input");
    if (afi) {
      afi.onchange = () => {
        const file = afi.files?.[0];
        if (!file) return;
        if (file.size > MAX_AVATAR_SIZE) {
          showToast("Макс. размер аватарки: 5 МБ", "error"); afi.value=""; return;
        }
        if (!file.type.startsWith("image/")) {
          showToast("Только изображения", "error"); afi.value=""; return;
        }
        window._pendingAvatarFile = file;
        selectedStockUrl = null;
        document.querySelectorAll(".avatar-stock-item").forEach(i => i.classList.remove("selected"));
        // Show local preview
        const reader = new FileReader();
        reader.onload = e => {
          const prev = document.getElementById("modal-avatar-preview");
          if (prev) prev.innerHTML = `
            <img src="${e.target.result}" style="width:60px;height:60px;border-radius:50%;border:2px solid var(--accent);" />
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-top:4px;">${file.name}</div>`;
        };
        reader.readAsDataURL(file);
        afi.value = "";
      };
    }
  }, 200);
}

async function uploadAvatar(file) {
  if (!file || !session.username) return;
  showToast("Загружаю аватарку...", "info", 10000);
  try {
    const path = `avatars/${session.username}/avatar_${Date.now()}`;
    const storageRef = ref(storage, path);
    const snap = await new Promise((res, rej) => {
      const task = uploadBytesResumable(storageRef, file);
      task.on("state_changed", null, rej, () => res(task.snapshot));
    });
    const url = await getDownloadURL(snap.ref);
    await saveAvatarUrl(url);
  } catch(e) {
    console.error("[AvatarUpload]", e);
    showToast("Ошибка загрузки аватарки", "error");
  }
}

async function saveAvatarUrl(url) {
  if (!session.username) return;
  try {
    await updateDoc(doc(firestore, "users", session.username), { avatarUrl: url });
    session.avatarUrl = url;
    // Update all avatar elements in UI
    updateAllAvatars(url);
    showToast("Аватарка обновлена ✓", "success");
  } catch(e) {
    console.error("[SaveAvatar]", e);
    showToast("Ошибка сохранения", "error");
  }
}

function updateAllAvatars(url) {
  const ids = ["profile-avatar-img"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = url;
  });
  const sa = document.getElementById("settings-avatar");
  if (sa) sa.innerHTML = `<img src="${url}" onerror="this.src='${getAvatarUrl(session.username)}'" />`;
}

// ══════════════════════════════════════════
// GAMES TAB
// ══════════════════════════════════════════
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
  });

  // Close game
  document.getElementById("btn-close-game")?.addEventListener("click", () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe) { iframe.src = ""; }
    document.getElementById("game-frame-container")?.classList.add("hidden");
    // Revoke old blob URL
    if (window._currentGameUrl) {
      URL.revokeObjectURL(window._currentGameUrl);
      window._currentGameUrl = null;
    }
  });

  document.getElementById("btn-reload-game")?.addEventListener("click", () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe && window._currentGameUrl) {
      iframe.src = "";
      setTimeout(() => { iframe.src = window._currentGameUrl; }, 100);
    }
  });
}

function launchGame(game) {
  const container = document.getElementById("game-frame-container");
  const iframe    = document.getElementById("game-iframe");
  const title     = document.getElementById("game-frame-title");
  if (!container || !iframe) return;

  // Revoke previous
  if (window._currentGameUrl) {
    URL.revokeObjectURL(window._currentGameUrl);
    window._currentGameUrl = null;
  }

  const url = getGameUrl(game.id);
  if (!url) return;

  window._currentGameUrl = url;
  if (title) title.textContent = `${game.icon} ${game.title}`;
  iframe.src = url;
  container.classList.remove("hidden");
  gsap.fromTo(container, { opacity:0 }, { duration:.28, opacity:1 });
}

// ══════════════════════════════════════════
// PROFILE TAB
// ══════════════════════════════════════════
function initProfileTab(userSession) {
  // Edit bio
  document.getElementById("btn-edit-bio")?.addEventListener("click", () => {
    const curBio = document.getElementById("profile-bio")?.textContent || "";
    const displayBio = curBio === "Тайна окутывает всё..." ? "" : curBio;
    showModal({
      title: "О себе",
      body: `
        <textarea id="modal-bio-input" maxlength="200" rows="4"
          placeholder="Расскажи что-нибудь о себе..."
          style="width:100%;background:var(--bg-surface);border:1px solid var(--border-input);
          border-radius:8px;padding:10px 12px;color:var(--text-primary);
          font-family:var(--font-mono);font-size:13px;resize:none;line-height:1.5;margin-top:0;"
        >${escHtml(displayBio)}</textarea>
        <div style="text-align:right;font-size:10px;color:var(--text-muted);
          font-family:var(--font-mono);margin-top:4px;" id="bio-counter">0 / 200</div>`,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const newBio = document.getElementById("modal-bio-input")?.value || "";
            try {
              await updateDoc(doc(firestore,"users",session.username), { bio: newBio });
              session.bio = newBio;
              const bioEl = document.getElementById("profile-bio");
              if (bioEl) bioEl.textContent = newBio || "Тайна окутывает всё...";
              showToast("Биография сохранена ✓", "success");
            } catch(e) { showToast("Ошибка сохранения", "error"); }
          },
        },
        { label:"Отмена", className:"modal-btn--ghost" },
      ],
    });
    setTimeout(() => {
      const ta = document.getElementById("modal-bio-input");
      const counter = document.getElementById("bio-counter");
      if (ta && counter) {
        counter.textContent = `${ta.value.length} / 200`;
        ta.addEventListener("input", () => { counter.textContent = `${ta.value.length} / 200`; });
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }, 200);
  });

  // Avatar click on profile → avatar picker
  document.getElementById("profile-avatar-img")?.addEventListener("click", openAvatarPicker);
}

// ══════════════════════════════════════════
// ONLINE STATUS
// ══════════════════════════════════════════
async function setOffline() {
  if (!session.username) return;
  try {
    await updateDoc(doc(firestore,"users",session.username), {
      online: false, lastSeen: serverTimestamp(),
    });
  } catch(_) {}
}
async function setOnline() {
  if (!session.username) return;
  try {
    await updateDoc(doc(firestore,"users",session.username), { online: true });
  } catch(_) {}
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function escHtml(s) {
  return String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

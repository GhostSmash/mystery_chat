// ═══════════════════════════════════════════════════════
// app.js  ·  Mystery Chat
// Main orchestrator — wires Firebase, Auth, Chat, UI, Three.js
// ═══════════════════════════════════════════════════════

import { initThreeBackground, setBgIntensity } from "./three-bg.js";
import {
  initSplashText,
  showToast,
  showScreen,
  showModal,
  closeModal,
  initBottomNav,
  initSettingsToggle,
  initAutoResizeTextarea,
} from "./ui-animations.js";
import { initAuth, logoutUser, session } from "./auth.js";
import { initChat, populateProfileUI, getAvatarUrl } from "./chat.js";
import { notifyNewUser, getBotInfo } from "./bot-utils.js";
import { firestore } from "./firebase-config.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ══════════════════════════════════════════
// 1. INIT THREE.JS BACKGROUND
// ══════════════════════════════════════════
try {
  initThreeBackground(0.6);
} catch (err) {
  console.warn("[App] Three.js init failed:", err);
}

// ══════════════════════════════════════════
// 2. INIT LUCIDE ICONS
// ══════════════════════════════════════════
if (window.lucide) {
  lucide.createIcons();
}

// ══════════════════════════════════════════
// 3. INIT AUTH SPLASH TEXT (auth screen)
// ══════════════════════════════════════════
initSplashText("splash-text");

// ══════════════════════════════════════════
// 4. AUTH FLOW
// ══════════════════════════════════════════
initAuth(async (userSession) => {
  // Called after successful login/register
  await onLoginSuccess(userSession);
});

// ══════════════════════════════════════════
// 5. ON LOGIN SUCCESS
// ══════════════════════════════════════════
async function onLoginSuccess(userSession) {
  // Populate all UI with user data
  populateProfileUI({
    username:    userSession.username,
    displayName: userSession.displayName,
    bio:         userSession.bio || "",
    rep:         userSession.rep || 0,
  });

  // Init header splash text
  initSplashText("header-splash");

  // Init auto-resize textarea
  initAutoResizeTextarea("message-input");

  // Init bottom navigation
  initBottomNav((tab) => {
    // Optional: do something on tab change
  });

  // Init chat features
  initChat();

  // Init settings
  initSettings(userSession);

  // Transition from auth to main screen
  showScreen("screen-main", "right");

  // Re-run lucide icons after screen swap
  setTimeout(() => {
    if (window.lucide) lucide.createIcons();
  }, 100);

  // Notify bot about login (async, non-blocking)
  getBotInfo().catch(() => {});
}

// ══════════════════════════════════════════
// 6. SETTINGS
// ══════════════════════════════════════════
function initSettings(userSession) {
  // Logout
  const btnLogout = document.getElementById("setting-logout");
  btnLogout && btnLogout.addEventListener("click", () => {
    showModal({
      title: "Выйти?",
      body:  "Ты уверен, что хочешь выйти из Mystery Chat?",
      actions: [
        {
          label: "Выйти",
          className: "modal-btn--danger",
          onClick: async () => {
            await logoutUser();
            showToast("До свидания!", "info");

            // Reset auth steps
            const steps = document.querySelectorAll(".auth-step");
            steps.forEach((s, i) => {
              s.style.display = i === 0 ? "block" : "none";
              s.style.opacity = "";
              s.style.transform = "";
            });

            // Clear inputs
            ["input-username", "input-password", "input-reg-password", "input-reg-password2"].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.value = "";
            });

            showScreen("screen-auth", "left");
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });
  });

  // Notifications toggle
  initSettingsToggle("notif-toggle", (isOn) => {
    showToast(isOn ? "Уведомления включены" : "Уведомления выключены", "info");
  });

  // Background intensity slider
  const bgSlider = document.getElementById("bg-intensity-slider");
  bgSlider && bgSlider.addEventListener("input", () => {
    const val = parseInt(bgSlider.value) / 100;
    setBgIntensity(val);
  });

  // Change password (modal placeholder)
  const btnChangePw = document.getElementById("setting-change-password");
  btnChangePw && btnChangePw.addEventListener("click", () => {
    showModal({
      title: "Смена пароля",
      body:  "Функция смены пароля будет доступна в следующей версии.",
      actions: [{ label: "Понятно", className: "modal-btn--primary" }],
    });
  });

  // Theme (placeholder)
  const btnTheme = document.getElementById("setting-theme");
  btnTheme && btnTheme.addEventListener("click", () => {
    showToast("Сейчас доступна только тёмная тема", "info");
  });

  // Profile edit bio
  const btnEditBio = document.getElementById("btn-edit-bio");
  btnEditBio && btnEditBio.addEventListener("click", () => {
    const currentBio = document.getElementById("profile-bio")?.textContent || "";
    showModal({
      title: "Редактировать о себе",
      body:  `
        <textarea id="modal-bio-input"
          style="width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);
                 border-radius:8px;padding:10px;color:var(--text-primary);font-family:var(--font-mono);
                 font-size:13px;resize:none;min-height:80px;line-height:1.5;"
          maxlength="200"
          placeholder="Расскажи о себе...">${escapeHtml(currentBio === "Тайна окутывает всё..." ? "" : currentBio)}</textarea>
        <div style="text-align:right;font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:6px;">макс. 200 символов</div>
      `,
      actions: [
        {
          label: "Сохранить",
          className: "modal-btn--primary",
          onClick: async () => {
            const newBio = document.getElementById("modal-bio-input")?.value || "";
            try {
              await updateDoc(doc(firestore, "users", session.username), { bio: newBio });
              const bioEl = document.getElementById("profile-bio");
              if (bioEl) bioEl.textContent = newBio || "Тайна окутывает всё...";
              session.bio = newBio;
              showToast("Биография обновлена", "success");
            } catch {
              showToast("Ошибка сохранения", "error");
            }
          },
        },
        { label: "Отмена", className: "modal-btn--ghost" },
      ],
    });
  });

  // Header menu button
  const btnMenu = document.getElementById("btn-header-menu");
  btnMenu && btnMenu.addEventListener("click", () => {
    showModal({
      title: "Mystery Chat",
      body: `
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);line-height:1.8;">
          <div>👤 &nbsp;<span style="color:var(--accent);">@${userSession.username}</span></div>
          <div>🔮 &nbsp;Mystery Chat v1.0.0</div>
          <div>🛠 &nbsp;Made by <span style="color:var(--yellow);">Smashh</span></div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle);">
            Powered by Firebase v10 + Three.js + GSAP
          </div>
        </div>
      `,
      actions: [{ label: "Закрыть", className: "modal-btn--ghost" }],
    });
  });

  // Header search button → focus chat search
  const btnHeaderSearch = document.getElementById("btn-header-search");
  btnHeaderSearch && btnHeaderSearch.addEventListener("click", () => {
    // Switch to chats tab and focus search
    import("./ui-animations.js").then(({ switchTab }) => {
      switchTab("chats");
      setTimeout(() => {
        const el = document.getElementById("chat-search-input");
        if (el) el.focus();
      }, 350);
    });
  });
}

// ══════════════════════════════════════════
// 7. ONLINE STATUS — set offline on unload
// ══════════════════════════════════════════
window.addEventListener("beforeunload", async () => {
  if (session.username) {
    try {
      await updateDoc(doc(firestore, "users", session.username), {
        online: false,
        lastSeen: serverTimestamp(),
      });
    } catch (_) {}
  }
});

// ══════════════════════════════════════════
// 8. GLOBAL MODAL CLOSE ON OVERLAY CLICK
// ══════════════════════════════════════════
const modalOverlay = document.getElementById("modal-overlay");
modalOverlay && modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ══════════════════════════════════════════
// 9. HELPER
// ══════════════════════════════════════════
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

console.info(
  "%c🔮 Mystery Chat%c · v1.0.0 · Made by Smashh",
  "color:#7c6fff;font-size:16px;font-weight:bold;font-family:monospace;",
  "color:#8892b0;font-size:12px;font-family:monospace;"
);

// ═══════════════════════════════════════════════════════
// auth.js · Mystery Chat v3.1
// Fixed: events wired after Lucide, no race conditions
// Password migration v1→v2, Remember me, Auto-login
// ═══════════════════════════════════════════════════════
import { firestore } from "./firebase-config.js";
import { showToast, showAuthStep, showModal, setButtonLoading } from "./ui-animations.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const session = {
  uid: null, username: null, displayName: null,
  bio: "", rep: 0, avatarUrl: null,
};

const SALT_V1 = "mystery_salt_smashh_2024";
const SALT_V2 = "_mc_salt_v2";

export async function sha256(str, salt) {
  const enc = new TextEncoder().encode(str + salt);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────────────
// initAuth — called AFTER lucide.createIcons() so all
// DOM is stable. Returns { tryAutoLogin } so app.js
// can call auto-login separately after UI is shown.
// ─────────────────────────────────────────────────────
export function initAuth(onSuccess) {
  let pendingUsername = "";

  // Helper — never returns null, safe to call after Lucide
  const el = id => document.getElementById(id);

  // ── Step 0 → 1 ──────────────────────────────────────
  el("btn-username")?.addEventListener("click", () => {
    showAuthStep("auth-step-1", "forward");
    setTimeout(() => el("input-username")?.focus(), 300);
  });

  el("btn-back-0")?.addEventListener("click", () => {
    showAuthStep("auth-step-0", "back");
  });

  // ── Step 1: Continue ─────────────────────────────────
  const doStep1 = async () => {
    const raw = (el("input-username")?.value || "")
      .trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (raw.length < 3) {
      showToast("Минимум 3 символа (a-z 0-9 _)", "error");
      shake("input-username");
      return;
    }

    pendingUsername = raw;
    const btn = el("btn-continue-username");
    setButtonLoading(btn, true);
    authLoader(true);

    try {
      const snap = await getDoc(doc(firestore, "users", raw));
      if (snap.exists()) {
        const nameEl = el("step2-username-display");
        if (nameEl) nameEl.textContent = `@${raw}`;
        showAuthStep("auth-step-2", "forward");
        setTimeout(() => el("input-password")?.focus(), 300);
      } else {
        const labelEl = el("reg-username-label");
        if (labelEl) labelEl.textContent = `@${raw}`;
        showAuthStep("auth-step-3", "forward");
        setTimeout(() => el("input-reg-password")?.focus(), 300);
      }
    } catch (e) {
      console.error("[Auth step1]", e);
      showToast("Ошибка соединения с сервером", "error");
    } finally {
      setButtonLoading(btn, false);
      authLoader(false);
    }
  };

  el("btn-continue-username")?.addEventListener("click", doStep1);
  el("input-username")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doStep1();
  });

  el("btn-back-1")?.addEventListener("click", () => {
    showAuthStep("auth-step-1", "back");
  });

  // ── Step 2: Login ────────────────────────────────────
  const doLogin = async () => {
    const pw = el("input-password")?.value || "";
    if (!pw) {
      showToast("Введи пароль", "error");
      shake("input-password");
      return;
    }

    const btn = el("btn-login");
    setButtonLoading(btn, true);
    authLoader(true);

    try {
      const snap = await getDoc(doc(firestore, "users", pendingUsername));
      if (!snap.exists()) {
        showToast("Пользователь не найден", "error");
        return;
      }

      const data        = snap.data();
      const storedHash  = data.passwordHash || "";
      const hashV2      = await sha256(pw, SALT_V2);
      let   ok          = false;

      if (storedHash === hashV2) {
        ok = true;
      } else {
        // Fallback: try old salt (v1 migration)
        const hashV1 = await sha256(pw, SALT_V1);
        if (storedHash === hashV1) {
          ok = true;
          // Silently upgrade to v2 hash
          await updateDoc(doc(firestore, "users", pendingUsername), {
            passwordHash: hashV2,
          });
          console.info("[Auth] Migrated password hash v1→v2 for", pendingUsername);
        }
      }

      if (!ok) {
        showToast("Неверный пароль", "error");
        shake("input-password");
        if (el("input-password")) el("input-password").value = "";
        return;
      }

      // Populate session
      Object.assign(session, {
        uid:         pendingUsername,
        username:    pendingUsername,
        displayName: data.displayName || pendingUsername,
        bio:         data.bio         || "",
        rep:         data.rep         || 0,
        avatarUrl:   data.avatarUrl   || null,
      });

      await updateDoc(doc(firestore, "users", pendingUsername), {
        online: true, lastSeen: serverTimestamp(),
      }).catch(() => {});

      // Remember me
      if (el("remember-me-checkbox")?.checked) {
        localStorage.setItem("mc_remember", JSON.stringify({
          username: pendingUsername,
          hash:     hashV2,
        }));
      } else {
        localStorage.removeItem("mc_remember");
      }

      showToast(`Добро пожаловать, @${pendingUsername}! 🔮`, "success");
      onSuccess(session);

    } catch (e) {
      console.error("[Auth login]", e);
      showToast("Ошибка при входе", "error");
    } finally {
      setButtonLoading(btn, false);
      authLoader(false);
    }
  };

  el("btn-login")?.addEventListener("click", doLogin);
  el("input-password")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });

  // Toggle password visibility
  el("btn-toggle-pw")?.addEventListener("click", () => {
    const inp = el("input-password");
    if (!inp) return;
    inp.type = inp.type === "text" ? "password" : "text";
    // Re-render icon without calling lucide globally
    const ico = el("btn-toggle-pw")?.querySelector("i");
    if (ico) {
      ico.setAttribute("data-lucide", inp.type === "text" ? "eye-off" : "eye");
      if (window.lucide) lucide.createIcons({ nodes: [ico] });
    }
  });

  // Forgot password
  el("btn-forgot")?.addEventListener("click", e => {
    e.preventDefault();
    showModal({
      title: "Сброс пароля",
      body:  "Свяжись с администратором: <b style='color:var(--accent)'>@Smashh</b>",
      actions: [{ label: "Понял", className: "modal-btn--primary" }],
    });
  });

  // ── Step 3: Back from register ───────────────────────
  el("btn-back-2")?.addEventListener("click", () => {
    showAuthStep("auth-step-1", "back");
  });

  // ── Step 3: Register ─────────────────────────────────
  const doRegister = async () => {
    const pw1 = el("input-reg-password")?.value  || "";
    const pw2 = el("input-reg-password2")?.value || "";

    if (pw1.length < 6) {
      showToast("Минимум 6 символов", "error");
      shake("input-reg-password");
      return;
    }
    if (pw1 !== pw2) {
      showToast("Пароли не совпадают", "error");
      shake("input-reg-password2");
      return;
    }

    const btn = el("btn-register");
    setButtonLoading(btn, true);
    authLoader(true);

    try {
      const hash = await sha256(pw1, SALT_V2);
      await setDoc(doc(firestore, "users", pendingUsername), {
        username:     pendingUsername,
        displayName:  pendingUsername,
        passwordHash: hash,
        bio:          "",
        rep:          0,
        avatarUrl:    null,
        createdAt:    serverTimestamp(),
        lastSeen:     serverTimestamp(),
        online:       true,
      });

      Object.assign(session, {
        uid:         pendingUsername,
        username:    pendingUsername,
        displayName: pendingUsername,
        bio:         "",
        rep:         0,
        avatarUrl:   null,
      });

      showToast(`Аккаунт @${pendingUsername} создан! 🎉`, "success");
      onSuccess(session);

    } catch (e) {
      console.error("[Auth register]", e);
      showToast("Ошибка при регистрации", "error");
    } finally {
      setButtonLoading(btn, false);
      authLoader(false);
    }
  };

  el("btn-register")?.addEventListener("click", doRegister);
  el("input-reg-password2")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doRegister();
  });
}

// ─────────────────────────────────────────────────────
// Auto-login — called separately AFTER auth screen shown
// ─────────────────────────────────────────────────────
export async function tryAutoLogin(onSuccess) {
  const raw = localStorage.getItem("mc_remember");
  if (!raw) return false;

  let stored;
  try { stored = JSON.parse(raw); } catch (_) {
    localStorage.removeItem("mc_remember"); return false;
  }

  const { username, hash } = stored || {};
  if (!username || !hash) {
    localStorage.removeItem("mc_remember"); return false;
  }

  try {
    const snap = await getDoc(doc(firestore, "users", username));
    if (!snap.exists()) {
      localStorage.removeItem("mc_remember"); return false;
    }

    const data = snap.data();
    if (data.passwordHash !== hash) {
      // Password changed — invalidate
      localStorage.removeItem("mc_remember"); return false;
    }

    Object.assign(session, {
      uid:         username,
      username:    username,
      displayName: data.displayName || username,
      bio:         data.bio         || "",
      rep:         data.rep         || 0,
      avatarUrl:   data.avatarUrl   || null,
    });

    await updateDoc(doc(firestore, "users", username), {
      online: true, lastSeen: serverTimestamp(),
    }).catch(() => {});

    console.info("[Auth] Auto-login OK:", username);
    onSuccess(session);
    return true;

  } catch (e) {
    console.error("[Auth] Auto-login failed:", e);
    localStorage.removeItem("mc_remember");
    return false;
  }
}

// ─────────────────────────────────────────────────────
// Change password
// ─────────────────────────────────────────────────────
export async function changePassword(oldPw, newPw1, newPw2) {
  if (!session.username) return false;

  if (!oldPw) {
    showToast("Введи старый пароль", "error"); return false;
  }
  if (newPw1.length < 6) {
    showToast("Новый пароль мин. 6 символов", "error"); return false;
  }
  if (newPw1 !== newPw2) {
    showToast("Новые пароли не совпадают", "error"); return false;
  }

  try {
    const snap = await getDoc(doc(firestore, "users", session.username));
    if (!snap.exists()) return false;

    const stored  = snap.data().passwordHash || "";
    const oldV2   = await sha256(oldPw, SALT_V2);
    const oldV1   = await sha256(oldPw, SALT_V1);

    if (stored !== oldV2 && stored !== oldV1) {
      showToast("Старый пароль неверен", "error"); return false;
    }

    const newHash = await sha256(newPw1, SALT_V2);
    await updateDoc(doc(firestore, "users", session.username), {
      passwordHash: newHash,
    });

    // Update remember-me token if active
    const rm = localStorage.getItem("mc_remember");
    if (rm) {
      localStorage.setItem("mc_remember", JSON.stringify({
        username: session.username, hash: newHash,
      }));
    }

    showToast("Пароль успешно изменён ✓", "success");
    return true;

  } catch (e) {
    console.error("[Auth] changePassword:", e);
    showToast("Ошибка смены пароля", "error");
    return false;
  }
}

// ─────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────
export async function logoutUser() {
  if (session.username) {
    await updateDoc(doc(firestore, "users", session.username), {
      online: false, lastSeen: serverTimestamp(),
    }).catch(() => {});
  }
  Object.assign(session, {
    uid: null, username: null, displayName: null,
    bio: "", rep: 0, avatarUrl: null,
  });
  localStorage.removeItem("mc_remember");
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
function authLoader(show) {
  document.getElementById("auth-loader")
    ?.classList.toggle("hidden", !show);
}

function shake(id) {
  const el = document.getElementById(id);
  if (!el || !window.gsap) return;
  gsap.fromTo(el,
    { x: -9 },
    { x: 0, duration: .4, ease: "elastic.out(1,.35)" }
  );
}

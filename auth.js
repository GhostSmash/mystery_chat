// ═══════════════════════════════════════════════════════
// auth.js · Mystery Chat v3
// Password hash migration (v1→v2) + "Remember me" auto-login
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

// Salts: v1 = old, v2 = new
const SALT_V1 = "mystery_salt_smashh_2024";
const SALT_V2 = "_mc_salt_v2";

async function sha256(str, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str + salt));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function initAuth(onSuccess) {
  const $ = id => document.getElementById(id);
  let pendingUsername = "";

  // ── Step 0 → 1 ──
  $("btn-username")?.addEventListener("click", () => {
    showAuthStep("auth-step-1", "forward");
    setTimeout(() => $("input-username")?.focus(), 350);
  });
  $("btn-back-0")?.addEventListener("click", () => showAuthStep("auth-step-0", "back"));

  // ── Step 1: Continue ──
  $("btn-continue-username")?.addEventListener("click", async () => {
    const raw = ($("input-username")?.value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (raw.length < 3) {
      showToast("Минимум 3 символа (a-z 0-9 _)", "error");
      shake("input-username");
      return;
    }
    pendingUsername = raw;
    const btn = $("btn-continue-username");
    setButtonLoading(btn, true);
    authLoader(true);

    try {
      const snap = await getDoc(doc(firestore, "users", raw));
      if (snap.exists()) {
        $("step2-username-display").textContent = `@${raw}`;
        showAuthStep("auth-step-2", "forward");
        setTimeout(() => $("input-password")?.focus(), 350);
      } else {
        $("reg-username-label").textContent = `@${raw}`;
        showAuthStep("auth-step-3", "forward");
        setTimeout(() => $("input-reg-password")?.focus(), 350);
      }
    } catch (e) {
      console.error(e);
      showToast("Ошибка соединения", "error");
    } finally {
      setButtonLoading(btn, false);
      authLoader(false);
    }
  });
  $("input-username")?.addEventListener("keydown", e => {
    if (e.key === "Enter") $("btn-continue-username")?.click();
  });

  // ── Step 2: Back ──
  $("btn-back-1")?.addEventListener("click", () => showAuthStep("auth-step-1", "back"));

  // ── Step 2: Login ──
  $("btn-login")?.addEventListener("click", async () => {
    const pw = $("input-password")?.value || "";
    if (!pw) {
      showToast("Введи пароль", "error");
      shake("input-password");
      return;
    }

    const btn = $("btn-login");
    setButtonLoading(btn, true);
    authLoader(true);

    try {
      const snap = await getDoc(doc(firestore, "users", pendingUsername));
      if (!snap.exists()) {
        showToast("Пользователь не найден", "error");
        return;
      }

      const data = snap.data();
      const storedHash = data.passwordHash;

      // Try v2 hash first
      const hashV2 = await sha256(pw, SALT_V2);
      let authenticated = false;

      if (storedHash === hashV2) {
        authenticated = true;
      } else {
        // Fallback: try v1 hash (old accounts)
        const hashV1 = await sha256(pw, SALT_V1);
        if (storedHash === hashV1) {
          authenticated = true;
          // Migrate: rehash with v2 salt
          await updateDoc(doc(firestore, "users", pendingUsername), {
            passwordHash: hashV2,
          });
          console.info("[Auth] Password migrated from v1 to v2");
        }
      }

      if (!authenticated) {
        showToast("Неверный пароль", "error");
        shake("input-password");
        $("input-password").value = "";
        return;
      }

      // Success
      Object.assign(session, {
        uid: pendingUsername,
        username: pendingUsername,
        displayName: data.displayName || pendingUsername,
        bio: data.bio || "",
        rep: data.rep || 0,
        avatarUrl: data.avatarUrl || null,
      });

      await updateDoc(doc(firestore, "users", pendingUsername), {
        lastSeen: serverTimestamp(),
        online: true,
      });

      // Save to localStorage if "remember me" checked
      const rememberCheckbox = $("remember-me-checkbox");
      if (rememberCheckbox?.checked) {
        localStorage.setItem("mc_remember", JSON.stringify({
          username: pendingUsername,
          passwordHash: hashV2,
        }));
      } else {
        localStorage.removeItem("mc_remember");
      }

      showToast(`Добро пожаловать, @${session.username}! 🔮`, "success");
      onSuccess(session);
    } catch (e) {
      console.error(e);
      showToast("Ошибка при входе", "error");
    } finally {
      setButtonLoading(btn, false);
      authLoader(false);
    }
  });

  $("input-password")?.addEventListener("keydown", e => {
    if (e.key === "Enter") $("btn-login")?.click();
  });

  // ── Toggle password visibility ──
  $("btn-toggle-pw")?.addEventListener("click", () => {
    const inp = $("input-password");
    if (!inp) return;
    inp.type = inp.type === "text" ? "password" : "text";
    const icon = $("btn-toggle-pw")?.querySelector("i");
    if (icon) {
      icon.setAttribute("data-lucide", inp.type === "text" ? "eye-off" : "eye");
      if (window.lucide) lucide.createIcons();
    }
  });

  // ── Forgot password ──
  $("btn-forgot")?.addEventListener("click", e => {
    e.preventDefault();
    showModal({
      title: "Сброс пароля",
      body: "Свяжись с администратором: <b>@Smashh</b>",
      actions: [{ label: "Понял", className: "modal-btn--primary" }],
    });
  });

  // ── Step 3: Back ──
  $("btn-back-2")?.addEventListener("click", () => showAuthStep("auth-step-1", "back"));

  // ── Step 3: Register ──
  $("btn-register")?.addEventListener("click", async () => {
    const pw1 = $("input-reg-password")?.value || "";
    const pw2 = $("input-reg-password2")?.value || "";
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

    const btn = $("btn-register");
    setButtonLoading(btn, true);
    authLoader(true);

    try {
      const hash = await sha256(pw1, SALT_V2);
      await setDoc(doc(firestore, "users", pendingUsername), {
        username: pendingUsername,
        displayName: pendingUsername,
        passwordHash: hash,
        bio: "",
        rep: 0,
        avatarUrl: null,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        online: true,
      });

      Object.assign(session, {
        uid: pendingUsername,
        username: pendingUsername,
        displayName: pendingUsername,
        bio: "",
        rep: 0,
        avatarUrl: null,
      });

      showToast(`Аккаунт @${pendingUsername} создан! 🎉`, "success");
      onSuccess(session);
    } catch (e) {
      console.error(e);
      showToast("Ошибка при регистрации", "error");
    } finally {
      setButtonLoading(btn, false);
      authLoader(false);
    }
  });

  $("input-reg-password2")?.addEventListener("keydown", e => {
    if (e.key === "Enter") $("btn-register")?.click();
  });

  // ── AUTO-LOGIN on page load ──
  tryAutoLogin(onSuccess);
}

// ════════════════════════════════════
// AUTO-LOGIN
// ════════════════════════════════════
async function tryAutoLogin(onSuccess) {
  const stored = localStorage.getItem("mc_remember");
  if (!stored) return;

  try {
    const { username, passwordHash } = JSON.parse(stored);
    if (!username || !passwordHash) return;

    const snap = await getDoc(doc(firestore, "users", username));
    if (!snap.exists()) {
      localStorage.removeItem("mc_remember");
      return;
    }

    const data = snap.data();
    if (data.passwordHash !== passwordHash) {
      // Hash mismatch — password was changed
      localStorage.removeItem("mc_remember");
      return;
    }

    // Success — auto-login
    Object.assign(session, {
      uid: username,
      username: username,
      displayName: data.displayName || username,
      bio: data.bio || "",
      rep: data.rep || 0,
      avatarUrl: data.avatarUrl || null,
    });

    await updateDoc(doc(firestore, "users", username), {
      lastSeen: serverTimestamp(),
      online: true,
    });

    console.info("[Auth] Auto-login successful:", username);
    onSuccess(session);
  } catch (e) {
    console.error("[Auth] Auto-login failed:", e);
    localStorage.removeItem("mc_remember");
  }
}

// ════════════════════════════════════
// CHANGE PASSWORD
// ════════════════════════════════════
export async function changePassword(oldPw, newPw1, newPw2) {
  if (!session.username) return false;
  if (newPw1.length < 6) {
    showToast("Новый пароль мин. 6 символов", "error");
    return false;
  }
  if (newPw1 !== newPw2) {
    showToast("Новые пароли не совпадают", "error");
    return false;
  }

  try {
    const snap = await getDoc(doc(firestore, "users", session.username));
    if (!snap.exists()) return false;

    const oldHashV2 = await sha256(oldPw, SALT_V2);
    const oldHashV1 = await sha256(oldPw, SALT_V1);
    const storedHash = snap.data().passwordHash;

    if (storedHash !== oldHashV2 && storedHash !== oldHashV1) {
      showToast("Старый пароль неверен", "error");
      return false;
    }

    const newHash = await sha256(newPw1, SALT_V2);
    await updateDoc(doc(firestore, "users", session.username), {
      passwordHash: newHash,
    });

    // Update localStorage if "remember me" was on
    const stored = localStorage.getItem("mc_remember");
    if (stored) {
      localStorage.setItem("mc_remember", JSON.stringify({
        username: session.username,
        passwordHash: newHash,
      }));
    }

    showToast("Пароль успешно изменён ✓", "success");
    return true;
  } catch (e) {
    console.error(e);
    showToast("Ошибка смены пароля", "error");
    return false;
  }
}

// ════════════════════════════════════
// LOGOUT
// ════════════════════════════════════
export async function logoutUser() {
  if (session.username) {
    try {
      await updateDoc(doc(firestore, "users", session.username), {
        online: false,
        lastSeen: serverTimestamp(),
      });
    } catch (_) {}
  }
  Object.assign(session, {
    uid: null, username: null, displayName: null,
    bio: "", rep: 0, avatarUrl: null,
  });
  localStorage.removeItem("mc_remember");
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════
function authLoader(show) {
  document.getElementById("auth-loader")?.classList.toggle("hidden", !show);
}

function shake(id) {
  const el = document.getElementById(id);
  if (el && window.gsap) {
    gsap.fromTo(el, { x: -10 }, { x: 0, duration: .42, ease: "elastic.out(1,.3)" });
  }
}

export { sha256 };

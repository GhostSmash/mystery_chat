// ═══════════════════════════════════════════════════════
// auth.js  ·  Mystery Chat
// Username+Password auth via Firestore (custom, no Firebase Auth)
// Flow: check user exists → password → login or register
// ═══════════════════════════════════════════════════════

import { firestore }    from "./firebase-config.js";
import { showToast, showAuthStep, showScreen, setButtonLoading, showModal } from "./ui-animations.js";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// In-memory session state
export const session = {
  uid:         null,
  username:    null,
  displayName: null,
  bio:         "",
  rep:         0,
};

// Simple hash using SHA-256 via Web Crypto (no external libs)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data     = encoder.encode(password + "mystery_salt_smashh_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── INIT AUTH UI ──
export function initAuth(onSuccess) {
  const btnUsernameMode  = document.getElementById("btn-username");
  const btnContinueUser  = document.getElementById("btn-continue-username");
  const btnLogin         = document.getElementById("btn-login");
  const btnRegister      = document.getElementById("btn-register");
  const btnBack0         = document.getElementById("btn-back-0");
  const btnBack1         = document.getElementById("btn-back-1");
  const btnBack2         = document.getElementById("btn-back-2");
  const btnTogglePw      = document.getElementById("btn-toggle-pw");
  const btnForgot        = document.getElementById("btn-forgot");
  const inputUsername    = document.getElementById("input-username");
  const inputPassword    = document.getElementById("input-password");
  const inputRegPw       = document.getElementById("input-reg-password");
  const inputRegPw2      = document.getElementById("input-reg-password2");

  let pendingUsername = "";

  // ── Step 0 → Step 1 ──
  btnUsernameMode.addEventListener("click", () => {
    showAuthStep("auth-step-1", "forward");
    setTimeout(() => inputUsername && inputUsername.focus(), 350);
  });

  // ── Step 1: back ──
  btnBack0.addEventListener("click", () => {
    showAuthStep("auth-step-0", "back");
  });

  // ── Step 1: continue (check if user exists) ──
  btnContinueUser.addEventListener("click", async () => {
    const username = (inputUsername.value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!username || username.length < 3) {
      showToast("Минимум 3 символа, только a-z 0-9 _", "error");
      shakeElement("input-username");
      return;
    }
    pendingUsername = username;

    setButtonLoading(btnContinueUser, true);
    showAuthLoader(true);

    try {
      const userDoc = await getDoc(doc(firestore, "users", username));

      if (userDoc.exists()) {
        // User found → go to password step
        document.getElementById("step2-username-display").textContent = `@${username}`;
        showAuthStep("auth-step-2", "forward");
        setTimeout(() => inputPassword && inputPassword.focus(), 350);
      } else {
        // User not found → go to register step
        document.getElementById("reg-username-label").textContent = `@${username}`;
        showAuthStep("auth-step-3", "forward");
        setTimeout(() => inputRegPw && inputRegPw.focus(), 350);
      }
    } catch (err) {
      console.error("[Auth] Check user error:", err);
      showToast("Ошибка соединения с базой данных", "error");
    } finally {
      setButtonLoading(btnContinueUser, false);
      showAuthLoader(false);
    }
  });

  // Allow Enter key on username input
  inputUsername && inputUsername.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnContinueUser.click();
  });

  // ── Step 2: back ──
  btnBack1.addEventListener("click", () => {
    showAuthStep("auth-step-1", "back");
  });

  // ── Step 2: login ──
  btnLogin.addEventListener("click", async () => {
    const password = inputPassword.value;
    if (!password) {
      showToast("Введи пароль", "error");
      shakeElement("input-password");
      return;
    }

    setButtonLoading(btnLogin, true);
    showAuthLoader(true);

    try {
      const userDoc  = await getDoc(doc(firestore, "users", pendingUsername));
      if (!userDoc.exists()) {
        showToast("Пользователь не найден", "error");
        return;
      }

      const data     = userDoc.data();
      const hashed   = await hashPassword(password);

      if (data.passwordHash !== hashed) {
        showToast("Неверный пароль", "error");
        shakeElement("input-password");
        inputPassword.value = "";
        return;
      }

      // ✅ Logged in
      session.uid         = pendingUsername;
      session.username    = pendingUsername;
      session.displayName = data.displayName || pendingUsername;
      session.bio         = data.bio || "";
      session.rep         = data.rep || 0;

      // Update last seen
      await updateDoc(doc(firestore, "users", pendingUsername), {
        lastSeen: serverTimestamp(),
        online:   true,
      });

      showToast(`Добро пожаловать, @${session.username}!`, "success");
      onSuccess(session);

    } catch (err) {
      console.error("[Auth] Login error:", err);
      showToast("Ошибка при входе", "error");
    } finally {
      setButtonLoading(btnLogin, false);
      showAuthLoader(false);
    }
  });

  inputPassword && inputPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnLogin.click();
  });

  // ── Toggle password visibility ──
  btnTogglePw && btnTogglePw.addEventListener("click", () => {
    const isText = inputPassword.type === "text";
    inputPassword.type = isText ? "password" : "text";
    btnTogglePw.querySelector("i").setAttribute("data-lucide", isText ? "eye" : "eye-off");
    if (window.lucide) lucide.createIcons();
  });

  // ── Forgot password ──
  btnForgot && btnForgot.addEventListener("click", (e) => {
    e.preventDefault();
    showModal({
      title: "Сброс пароля",
      body:  "Эта функция пока недоступна. Свяжись с администратором.<br><br><span style=\"font-family:var(--font-mono);font-size:12px;color:var(--text-muted);\">@Smashh</span>",
      actions: [{ label: "Понял", className: "modal-btn--primary" }],
    });
  });

  // ── Step 3: back ──
  btnBack2.addEventListener("click", () => {
    showAuthStep("auth-step-1", "back");
  });

  // ── Step 3: register ──
  btnRegister.addEventListener("click", async () => {
    const pw1 = inputRegPw.value;
    const pw2 = inputRegPw2.value;

    if (pw1.length < 6) {
      showToast("Минимум 6 символов", "error");
      shakeElement("input-reg-password");
      return;
    }
    if (pw1 !== pw2) {
      showToast("Пароли не совпадают", "error");
      shakeElement("input-reg-password2");
      return;
    }

    setButtonLoading(btnRegister, true);
    showAuthLoader(true);

    try {
      const hashed = await hashPassword(pw1);

      const userData = {
        username:     pendingUsername,
        displayName:  pendingUsername,
        passwordHash: hashed,
        bio:          "",
        rep:          0,
        createdAt:    serverTimestamp(),
        lastSeen:     serverTimestamp(),
        online:       true,
      };

      await setDoc(doc(firestore, "users", pendingUsername), userData);

      session.uid         = pendingUsername;
      session.username    = pendingUsername;
      session.displayName = pendingUsername;
      session.bio         = "";
      session.rep         = 0;

      showToast(`Аккаунт @${pendingUsername} создан!`, "success");
      onSuccess(session);

    } catch (err) {
      console.error("[Auth] Register error:", err);
      showToast("Ошибка при регистрации", "error");
    } finally {
      setButtonLoading(btnRegister, false);
      showAuthLoader(false);
    }
  });

  inputRegPw2 && inputRegPw2.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnRegister.click();
  });
}

// ── LOGOUT ──
export async function logoutUser() {
  try {
    if (session.username) {
      await updateDoc(doc(firestore, "users", session.username), { online: false });
    }
  } catch (_) {}

  session.uid         = null;
  session.username    = null;
  session.displayName = null;
  session.bio         = "";
  session.rep         = 0;
}

// ── HELPERS ──
function showAuthLoader(show) {
  const el = document.getElementById("auth-loader");
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function shakeElement(id) {
  const el = document.getElementById(id);
  if (!el || !window.gsap) return;
  gsap.fromTo(
    el,
    { x: -8 },
    { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" }
  );
}

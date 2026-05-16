// ═══════════════════════════════════════════════════════
// auth.js · Mystery Chat v2
// Username+Password · Register · Change Password
// ═══════════════════════════════════════════════════════
import { firestore } from "./firebase-config.js";
import { showToast, showAuthStep, showModal, setButtonLoading } from "./ui-animations.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const session = { uid: null, username: null, displayName: null, bio: "", rep: 0, avatarUrl: null };

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str + "_mc_salt_v2"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export function initAuth(onSuccess) {
  const $ = id => document.getElementById(id);
  let pendingUsername = "";

  // Step 0 → 1
  $("btn-username").addEventListener("click", () => {
    showAuthStep("auth-step-1", "forward");
    setTimeout(() => $("input-username")?.focus(), 340);
  });
  $("btn-back-0").addEventListener("click", () => showAuthStep("auth-step-0", "back"));

  // Step 1: Continue
  $("btn-continue-username").addEventListener("click", async () => {
    const raw = ($("input-username").value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if (raw.length < 3) { showToast("Мин. 3 символа (a-z 0-9 _)", "error"); shake("input-username"); return; }
    pendingUsername = raw;
    const btn = $("btn-continue-username");
    setButtonLoading(btn, true); authLoader(true);
    try {
      const snap = await getDoc(doc(firestore, "users", raw));
      if (snap.exists()) {
        $("step2-username-display").textContent = `@${raw}`;
        showAuthStep("auth-step-2", "forward");
        setTimeout(() => $("input-password")?.focus(), 340);
      } else {
        $("reg-username-label").textContent = `@${raw}`;
        showAuthStep("auth-step-3", "forward");
        setTimeout(() => $("input-reg-password")?.focus(), 340);
      }
    } catch(e) {
      console.error(e); showToast("Ошибка соединения", "error");
    } finally { setButtonLoading(btn, false); authLoader(false); }
  });
  $("input-username").addEventListener("keydown", e => { if(e.key==="Enter") $("btn-continue-username").click(); });

  // Step 2: Back
  $("btn-back-1").addEventListener("click", () => showAuthStep("auth-step-1", "back"));

  // Step 2: Login
  $("btn-login").addEventListener("click", async () => {
    const pw = $("input-password").value;
    if (!pw) { showToast("Введи пароль", "error"); shake("input-password"); return; }
    const btn = $("btn-login");
    setButtonLoading(btn, true); authLoader(true);
    try {
      const snap = await getDoc(doc(firestore, "users", pendingUsername));
      if (!snap.exists()) { showToast("Пользователь не найден", "error"); return; }
      const data = snap.data();
      const hash = await sha256(pw);
      if (data.passwordHash !== hash) {
        showToast("Неверный пароль", "error"); shake("input-password");
        $("input-password").value = ""; return;
      }
      Object.assign(session, {
        uid: pendingUsername, username: pendingUsername,
        displayName: data.displayName || pendingUsername,
        bio: data.bio || "", rep: data.rep || 0,
        avatarUrl: data.avatarUrl || null,
      });
      await updateDoc(doc(firestore, "users", pendingUsername), { lastSeen: serverTimestamp(), online: true });
      showToast(`Добро пожаловать, @${session.username}! 🔮`, "success");
      onSuccess(session);
    } catch(e) {
      console.error(e); showToast("Ошибка при входе", "error");
    } finally { setButtonLoading(btn, false); authLoader(false); }
  });
  $("input-password").addEventListener("keydown", e => { if(e.key==="Enter") $("btn-login").click(); });

  // Toggle password
  $("btn-toggle-pw").addEventListener("click", () => {
    const inp = $("input-password");
    inp.type = inp.type === "text" ? "password" : "text";
    const icon = $("btn-toggle-pw").querySelector("i");
    if (icon) { icon.setAttribute("data-lucide", inp.type === "text" ? "eye-off" : "eye"); if(window.lucide) lucide.createIcons(); }
  });

  // Forgot password
  $("btn-forgot")?.addEventListener("click", e => {
    e.preventDefault();
    showModal({ title:"Сброс пароля", body:"Свяжись с администратором: <b>@Smashh</b>", actions:[{label:"Понял",className:"modal-btn--primary"}] });
  });

  // Step 3: Back
  $("btn-back-2").addEventListener("click", () => showAuthStep("auth-step-1", "back"));

  // Step 3: Register
  $("btn-register").addEventListener("click", async () => {
    const pw1 = $("input-reg-password").value;
    const pw2 = $("input-reg-password2").value;
    if (pw1.length < 6) { showToast("Мин. 6 символов", "error"); shake("input-reg-password"); return; }
    if (pw1 !== pw2)   { showToast("Пароли не совпадают", "error"); shake("input-reg-password2"); return; }
    const btn = $("btn-register");
    setButtonLoading(btn, true); authLoader(true);
    try {
      const hash = await sha256(pw1);
      await setDoc(doc(firestore, "users", pendingUsername), {
        username: pendingUsername, displayName: pendingUsername,
        passwordHash: hash, bio: "", rep: 0, avatarUrl: null,
        createdAt: serverTimestamp(), lastSeen: serverTimestamp(), online: true,
      });
      Object.assign(session, { uid: pendingUsername, username: pendingUsername, displayName: pendingUsername, bio: "", rep: 0, avatarUrl: null });
      showToast(`Аккаунт @${pendingUsername} создан! 🎉`, "success");
      onSuccess(session);
    } catch(e) {
      console.error(e); showToast("Ошибка при регистрации", "error");
    } finally { setButtonLoading(btn, false); authLoader(false); }
  });
  $("input-reg-password2").addEventListener("keydown", e => { if(e.key==="Enter") $("btn-register").click(); });
}

// ── CHANGE PASSWORD ──
export async function changePassword(oldPw, newPw1, newPw2) {
  if (!session.username) return false;
  if (newPw1.length < 6)   { showToast("Новый пароль мин. 6 символов", "error"); return false; }
  if (newPw1 !== newPw2)   { showToast("Новые пароли не совпадают", "error");  return false; }
  try {
    const snap = await getDoc(doc(firestore, "users", session.username));
    if (!snap.exists()) return false;
    const oldHash = await sha256(oldPw);
    if (snap.data().passwordHash !== oldHash) { showToast("Старый пароль неверен", "error"); return false; }
    const newHash = await sha256(newPw1);
    await updateDoc(doc(firestore, "users", session.username), { passwordHash: newHash });
    showToast("Пароль успешно изменён ✓", "success");
    return true;
  } catch(e) {
    console.error(e); showToast("Ошибка смены пароля", "error"); return false;
  }
}

// ── LOGOUT ──
export async function logoutUser() {
  if (session.username) {
    try { await updateDoc(doc(firestore,"users",session.username),{online:false,lastSeen:serverTimestamp()}); } catch(_){}
  }
  Object.assign(session, { uid:null, username:null, displayName:null, bio:"", rep:0, avatarUrl:null });
}

function authLoader(show) { document.getElementById("auth-loader")?.classList.toggle("hidden", !show); }
function shake(id) {
  const el = document.getElementById(id);
  if (el && window.gsap) gsap.fromTo(el, { x:-8 }, { x:0, duration:.4, ease:"elastic.out(1,.3)" });
}

export { sha256 };

// ═══════════════════════════════════════════════════════
// ui-animations.js · Mystery Chat v2
// ═══════════════════════════════════════════════════════

const SPLASH_TEXTS = [
  "Smashh inside!", "1% sugar!", "Pure mystery!",
  "100% certified!", "Telegram is shaking!", "No bugs... maybe",
  "VHS aesthetic!", "Dark mode forever!", "Smashh was here!",
  "Ultra instinct!", "Firebase powered!", "Three.js magic!",
];

let splashInterval = null;

export function initSplashText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const rnd = () => SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)];
  el.textContent = rnd();
  splashInterval = setInterval(() => {
    gsap.to(el, { duration: .12, opacity: 0, scale: .8, onComplete: () => {
      el.textContent = rnd();
      gsap.to(el, { duration: .12, opacity: 1, scale: 1 });
    }});
  }, 4500);
}

// ── TOAST ──
export function showToast(msg, type = "info", dur = 3000) {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  c.appendChild(t);
  gsap.to(t, { duration: .3, opacity: 1, y: 0, scale: 1, ease: "back.out(1.5)" });
  setTimeout(() => {
    gsap.to(t, { duration: .22, opacity: 0, y: -10, scale: .9, onComplete: () => t.remove() });
  }, dur);
}

// ── MODAL ──
export function showModal({ title = "", body = "", actions = [] }) {
  const overlay = document.getElementById("modal-overlay");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = body;
  const actEl = document.getElementById("modal-actions");
  actEl.innerHTML = "";
  actions.forEach(({ label, className, onClick }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = `modal-btn ${className || "modal-btn--ghost"}`;
    btn.addEventListener("click", () => { if (onClick) onClick(); closeModal(); });
    actEl.appendChild(btn);
  });
  overlay.classList.remove("hidden");
  gsap.fromTo("#modal-box",
    { opacity: 0, scale: .85, y: 30 },
    { duration: .32, opacity: 1, scale: 1, y: 0, ease: "back.out(1.4)" }
  );
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  gsap.to("#modal-box", {
    duration: .18, opacity: 0, scale: .9, y: 16,
    onComplete: () => overlay.classList.add("hidden"),
  });
}

// ── SCREEN TRANSITIONS ──
export function showScreen(screenId, direction = "right") {
  const all = document.querySelectorAll(".screen");
  const target = document.getElementById(screenId);
  if (!target) return;
  const xIn  = direction === "right" ? "100%" : "-100%";
  const xOut = direction === "right" ? "-30%"  : "30%";
  all.forEach(s => {
    if (s !== target && s.style.display !== "none") {
      gsap.to(s, { duration: .38, x: xOut, opacity: 0, ease: "power3.in",
        onComplete: () => { s.style.display = "none"; gsap.set(s, { x: 0, opacity: 1 }); }
      });
    }
  });
  target.style.display = "flex";
  gsap.fromTo(target, { x: xIn, opacity: 0 }, { duration: .42, x: "0%", opacity: 1, ease: "power3.out" });
}

// ── AUTH STEP TRANSITIONS ──
export function showAuthStep(stepId, dir = "forward") {
  const xIn  = dir === "forward" ?  40 : -40;
  const xOut = dir === "forward" ? -40 :  40;
  document.querySelectorAll(".auth-step").forEach(s => {
    if (s.id !== stepId && s.style.display !== "none") {
      gsap.to(s, { duration: .25, x: xOut, opacity: 0, ease: "power2.in",
        onComplete: () => { s.style.display = "none"; gsap.set(s, { x: 0, opacity: 1 }); }
      });
    }
  });
  const target = document.getElementById(stepId);
  if (!target) return;
  target.style.display = "block";
  gsap.fromTo(target, { x: xIn, opacity: 0 }, { duration: .3, x: 0, opacity: 1, ease: "power2.out" });
}

// ── TAB SWITCHING ──
let currentTab = "chats";
const TAB_ORDER = ["chats", "games", "profile", "settings"];

export function switchTab(tabName) {
  if (tabName === currentTab) return;
  const curIdx = TAB_ORDER.indexOf(currentTab);
  const newIdx = TAB_ORDER.indexOf(tabName);
  const dir = newIdx > curIdx ? 1 : -1;
  const cur = document.getElementById(`tab-${currentTab}`);
  const nxt = document.getElementById(`tab-${tabName}`);
  if (cur) gsap.to(cur, { duration: .24, x: dir * -40, opacity: 0, ease: "power2.in",
    onComplete: () => { cur.style.display = "none"; gsap.set(cur, { x: 0, opacity: 1 }); }
  });
  if (nxt) {
    nxt.style.display = "block";
    gsap.fromTo(nxt, { x: dir * 40, opacity: 0 }, { duration: .28, x: 0, opacity: 1, ease: "power2.out" });
  }
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  currentTab = tabName;
}

export function getCurrentTab() { return currentTab; }

// ── NAV INIT ──
export function initBottomNav(onTabChange) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      if (onTabChange) onTabChange(tab);
    });
  });
}

// ── SETTINGS TOGGLE ──
export function initSettingsToggle(id, onChange) {
  const t = document.getElementById(id);
  if (!t) return;
  t.addEventListener("click", () => { const on = t.classList.toggle("on"); if (onChange) onChange(on); });
}

// ── TEXTAREA AUTO-RESIZE ──
export function initAutoResizeTextarea(id) {
  const ta = document.getElementById(id);
  if (!ta) return;
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 100) + "px"; });
}

// ── SCROLL TO BOTTOM ──
export function scrollToBottom(id, smooth = true) {
  const el = document.getElementById(id);
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

// ── BUTTON LOADING ──
export function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = `<div class="loader-ring" style="width:17px;height:17px;border-width:2px;"></div>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._orig || btn.innerHTML;
    btn.disabled = false;
  }
}

// ── BUBBLE ANIMATE ──
export function animateBubbleIn(el) {
  gsap.fromTo(el, { opacity: 0, scale: .82, y: 8 }, { duration: .2, opacity: 1, scale: 1, y: 0, ease: "back.out(1.7)" });
}

// ── PEER PANEL ──
export function openPeerPanel() {
  const p = document.getElementById("peer-profile-panel");
  if (!p) return;
  p.classList.remove("hidden");
  gsap.fromTo(p, { x: "100%" }, { duration: .38, x: "0%", ease: "power3.out" });
}
export function closePeerPanel() {
  const p = document.getElementById("peer-profile-panel");
  if (!p) return;
  gsap.to(p, { duration: .3, x: "100%", ease: "power3.in", onComplete: () => p.classList.add("hidden") });
}

// ── SEARCH OVERLAY ──
export function openSearchOverlay() {
  const o = document.getElementById("search-overlay");
  if (!o) return;
  o.classList.remove("hidden");
  gsap.fromTo(o, { opacity: 0, y: -20 }, { duration: .28, opacity: 1, y: 0, ease: "power2.out" });
  setTimeout(() => document.getElementById("search-overlay-input")?.focus(), 200);
}
export function closeSearchOverlay() {
  const o = document.getElementById("search-overlay");
  if (!o) return;
  gsap.to(o, { duration: .2, opacity: 0, y: -10, ease: "power2.in", onComplete: () => o.classList.add("hidden") });
}

// ── THEME SWITCHER ──
const THEMES = ["dark","light","neon","ocean","sunset"];
export function applyTheme(name) {
  if (!THEMES.includes(name)) return;
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("mc_theme", name);
  document.querySelectorAll(".theme-btn").forEach(b => b.classList.toggle("active", b.dataset.theme === name));
}
export function loadSavedTheme() {
  const saved = localStorage.getItem("mc_theme") || "dark";
  applyTheme(saved);
}
export function initThemePicker() {
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
  });
}

// ── MODAL close on overlay click ──
document.getElementById("modal-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

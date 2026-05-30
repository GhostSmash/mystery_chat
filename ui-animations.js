// ═══════════════════════════════════════════════════════
// ui-animations.js · Mystery Chat v3
// Smooth GSAP transitions — slide-based, no fade flash
// ═══════════════════════════════════════════════════════

const SPLASH = [
  "Smashh inside!", "1% sugar!", "Pure mystery!", "No bugs! ...maybe",
  "VHS aesthetic!", "Telegram is scared!", "Firebase powered!",
  "Ultra instinct!", "Smashh was here!", "Dark mode only!",
  "v3 is here!", "Three.js magic!", "Certified fresh!",
];

let _splashTimer = null;

export function initSplashText(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const rnd = () => SPLASH[Math.floor(Math.random() * SPLASH.length)];
  el.textContent = rnd();
  _splashTimer = setInterval(() => {
    gsap.to(el, { duration: .1, opacity: 0, scale: .8, onComplete: () => {
      el.textContent = rnd();
      gsap.to(el, { duration: .1, opacity: 1, scale: 1 });
    }});
  }, 4500);
}

// ════════════════════════════════════
// TOAST
// ════════════════════════════════════
export function showToast(msg, type = "info", dur = 2800) {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  c.appendChild(t);
  // Force no CSS transition on toast
  t.style.transition = "none";
  gsap.fromTo(t,
    { opacity: 0, y: -14, scale: .88 },
    { opacity: 1, y: 0, scale: 1, duration: .28, ease: "back.out(1.8)" }
  );
  setTimeout(() => {
    gsap.to(t, {
      opacity: 0, y: -8, scale: .92, duration: .22, ease: "power2.in",
      onComplete: () => t.remove(),
    });
  }, dur);
}

// ════════════════════════════════════
// MODAL
// ════════════════════════════════════
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
  gsap.set("#modal-box", { clearProps: "all" });
  gsap.fromTo("#modal-box",
    { opacity: 0, scale: .82, y: 32 },
    { opacity: 1, scale: 1, y: 0, duration: .34, ease: "back.out(1.5)" }
  );
  // Backdrop
  gsap.fromTo(overlay, { "--bg-alpha": 0 }, {});
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: .22, ease: "power2.out" });
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return;
  gsap.to("#modal-box", {
    opacity: 0, scale: .9, y: 20, duration: .2, ease: "power2.in",
    onComplete: () => {
      overlay.classList.add("hidden");
      gsap.set("#modal-box", { clearProps: "all" });
    },
  });
}

// ════════════════════════════════════
// SCREEN TRANSITIONS — pure slide, no opacity flash
// ════════════════════════════════════
let _screenBusy = false;

export function showScreen(screenId, direction = "right") {
  if (_screenBusy) return;
  const target = document.getElementById(screenId);
  if (!target) return;

  const current = [...document.querySelectorAll(".screen")]
    .find(s => s !== target && s.style.display !== "none");

  const xEnter = direction === "right" ?  "100%" : "-100%";
  const xLeave = direction === "right" ? "-28%"  :  "28%";

  _screenBusy = true;

  if (current) {
    gsap.to(current, {
      x: xLeave,
      duration: .36,
      ease: "power3.in",
      onComplete: () => {
        current.style.display = "none";
        gsap.set(current, { x: 0 });
      },
    });
  }

  target.style.display = "flex";
  gsap.set(target, { x: xEnter });
  gsap.to(target, {
    x: "0%",
    duration: .38,
    ease: "power3.out",
    delay: current ? .04 : 0,
    onComplete: () => { _screenBusy = false; },
  });
}

// ════════════════════════════════════
// AUTH STEP TRANSITIONS
// ════════════════════════════════════
let _stepBusy = false;

export function showAuthStep(stepId, dir = "forward") {
  if (_stepBusy) return;
  const target = document.getElementById(stepId);
  if (!target) return;

  const xEnter = dir === "forward" ?  36 : -36;
  const xLeave = dir === "forward" ? -36 :  36;

  const current = [...document.querySelectorAll(".auth-step")]
    .find(s => s !== target && s.style.display !== "none");

  _stepBusy = true;

  if (current) {
    gsap.to(current, {
      x: xLeave, opacity: 0, duration: .24, ease: "power2.in",
      onComplete: () => {
        current.style.display = "none";
        gsap.set(current, { x: 0, opacity: 1 });
      },
    });
  }

  target.style.display = "block";
  gsap.fromTo(target,
    { x: xEnter, opacity: 0 },
    {
      x: 0, opacity: 1, duration: .28, ease: "power2.out",
      delay: current ? .08 : 0,
      onComplete: () => { _stepBusy = false; },
    }
  );
}

// ════════════════════════════════════
// TAB SWITCHING — smooth slide + subtle scale
// ════════════════════════════════════
let _currentTab = "chats";
const TAB_ORDER = ["chats", "games", "profile", "settings"];
let _tabBusy = false;

export function switchTab(tabName) {
  if (tabName === _currentTab || _tabBusy) return;
  const curIdx = TAB_ORDER.indexOf(_currentTab);
  const newIdx = TAB_ORDER.indexOf(tabName);
  const dir = newIdx > curIdx ? 1 : -1;

  const cur = document.getElementById(`tab-${_currentTab}`);
  const nxt = document.getElementById(`tab-${tabName}`);
  if (!nxt) return;

  _tabBusy = true;

  if (cur) {
    gsap.to(cur, {
      x: dir * -40, opacity: 0, duration: .22, ease: "power2.in",
      onComplete: () => {
        cur.style.display = "none";
        gsap.set(cur, { x: 0, opacity: 1 });
      },
    });
  }

  nxt.style.display = "block";
  gsap.fromTo(nxt,
    { x: dir * 40, opacity: 0 },
    {
      x: 0, opacity: 1, duration: .26, ease: "power2.out",
      delay: .06,
      onComplete: () => { _tabBusy = false; },
    }
  );

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  _currentTab = tabName;
}

export function getCurrentTab() { return _currentTab; }

// ════════════════════════════════════
// BOTTOM NAV
// ════════════════════════════════════
export function initBottomNav(onTabChange) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
      if (onTabChange) onTabChange(btn.dataset.tab);
    });
  });
}

// ════════════════════════════════════
// PEER PANEL (slide from right)
// ════════════════════════════════════
export function openPeerPanel() {
  const p = document.getElementById("peer-profile-panel");
  if (!p) return;
  p.classList.remove("hidden");
  gsap.fromTo(p, { x: "100%" }, { x: "0%", duration: .36, ease: "power3.out" });
}
export function closePeerPanel() {
  const p = document.getElementById("peer-profile-panel");
  if (!p) return;
  gsap.to(p, { x: "100%", duration: .3, ease: "power3.in",
    onComplete: () => p.classList.add("hidden"),
  });
}

// ════════════════════════════════════
// SEARCH OVERLAY (slide down from top)
// ════════════════════════════════════
export function openSearchOverlay() {
  const o = document.getElementById("search-overlay");
  if (!o) return;
  o.classList.remove("hidden");
  gsap.fromTo(o, { y: "-100%", opacity: 0 },
    { y: "0%", opacity: 1, duration: .3, ease: "power3.out" }
  );
  setTimeout(() => document.getElementById("search-overlay-input")?.focus(), 250);
}
export function closeSearchOverlay() {
  const o = document.getElementById("search-overlay");
  if (!o) return;
  gsap.to(o, {
    y: "-100%", opacity: 0, duration: .26, ease: "power3.in",
    onComplete: () => o.classList.add("hidden"),
  });
}

// ════════════════════════════════════
// TEXTAREA AUTO-RESIZE
// ════════════════════════════════════
export function initAutoResizeTextarea(id) {
  const ta = document.getElementById(id);
  if (!ta) return;
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  });
}

// ════════════════════════════════════
// SCROLL TO BOTTOM
// ════════════════════════════════════
export function scrollToBottom(id, smooth = true) {
  const el = document.getElementById(id);
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

// ════════════════════════════════════
// BUTTON LOADING
// ════════════════════════════════════
export function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = `<div class="loader-ring" style="width:17px;height:17px;border-width:2px;"></div>`;
    btn.disabled = true;
  } else {
    if (btn._orig !== undefined) btn.innerHTML = btn._orig;
    btn.disabled = false;
  }
}

// ════════════════════════════════════
// BUBBLE ANIMATE IN
// ════════════════════════════════════
export function animateBubbleIn(el) {
  gsap.fromTo(el,
    { opacity: 0, scale: .80, y: 10 },
    { opacity: 1, scale: 1, y: 0, duration: .22, ease: "back.out(1.8)" }
  );
}

// ════════════════════════════════════
// THEME
// ════════════════════════════════════
const THEMES = ["dark","light","neon","ocean","sunset","aurora","matrix","candy","midnight","liquid"];

export function applyTheme(name) {
  if (!THEMES.includes(name)) name = "dark";

  // Liquid glass warning
  if (name === "liquid") {
    const warned = localStorage.getItem("mc_liquid_warned");
    if (!warned) {
      showModal({
        title: "⚠️ Liquid Glass — предупреждение",
        body: `<div style="font-family:var(--font-mono);font-size:12px;color:var(--yellow);line-height:1.7;">
          Эта тема использует backdrop-filter: blur(60px) на всех элементах.<br>
          На слабых устройствах <b>может тормозить</b> и садить батарею.<br>
          Рекомендуется для современных телефонов и ПК.<br><br>
          <span style="color:var(--text-muted);">Это предупреждение показывается один раз.</span>
        </div>`,
        actions: [
          {
            label: "Всё равно применить",
            className: "modal-btn--primary",
            onClick: () => {
              localStorage.setItem("mc_liquid_warned", "1");
              _doApplyTheme(name);
            },
          },
          { label: "Отмена", className: "modal-btn--ghost" },
        ],
      });
      return;
    }
  }
  _doApplyTheme(name);
}

function _doApplyTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("mc_theme", name);
  document.querySelectorAll(".theme-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.theme === name)
  );
}

export function loadSavedTheme() {
  const saved = localStorage.getItem("mc_theme") || "dark";
  _doApplyTheme(saved);
}

export function initThemePicker() {
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
  });
}

// ════════════════════════════════════
// OVERLAY CLOSE
// ════════════════════════════════════
document.getElementById("modal-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

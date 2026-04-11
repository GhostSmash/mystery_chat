// ═══════════════════════════════════════════════════════
// ui-animations.js  ·  Mystery Chat
// GSAP transitions, toast system, modal system,
// bottom nav, splash text, tab switching
// ═══════════════════════════════════════════════════════

// ── SPLASH TEXTS ──
const SPLASH_TEXTS = [
  "Smashh inside!",
  "1% sugar!",
  "Pure mystery!",
  "100% offline ready!",
  "Telegram is scared!",
  "No bugs here...",
  "Dark mode only!",
  "Certified fresh!",
  "VHS aesthetic!",
  "Smashh was here!",
];

let splashInterval = null;

export function initSplashText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const randomText = () => SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)];

  el.textContent = randomText();

  splashInterval = setInterval(() => {
    gsap.to(el, {
      duration: 0.15,
      opacity: 0,
      scale: 0.8,
      onComplete: () => {
        el.textContent = randomText();
        gsap.to(el, { duration: 0.15, opacity: 1, scale: 1 });
      },
    });
  }, 4000);
}

export function stopSplashText() {
  if (splashInterval) clearInterval(splashInterval);
}

// ── TOAST SYSTEM ──
export function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  gsap.to(toast, {
    duration: 0.35,
    opacity: 1,
    y: 0,
    scale: 1,
    ease: "back.out(1.5)",
  });

  setTimeout(() => {
    gsap.to(toast, {
      duration: 0.25,
      opacity: 0,
      y: -10,
      scale: 0.9,
      onComplete: () => toast.remove(),
    });
  }, duration);
}

// ── MODAL SYSTEM ──
export function showModal({ title = "", body = "", actions = [] }) {
  const overlay = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const bodyEl  = document.getElementById("modal-body");
  const actEl   = document.getElementById("modal-actions");

  titleEl.textContent = title;
  bodyEl.innerHTML    = body;
  actEl.innerHTML     = "";

  actions.forEach(({ label, className, onClick }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className   = `modal-btn ${className || "modal-btn--ghost"}`;
    btn.addEventListener("click", () => {
      if (onClick) onClick();
      closeModal();
    });
    actEl.appendChild(btn);
  });

  overlay.classList.remove("hidden");
  const box = document.getElementById("modal-box");
  gsap.fromTo(
    box,
    { opacity: 0, scale: 0.85, y: 30 },
    { duration: 0.35, opacity: 1, scale: 1, y: 0, ease: "back.out(1.4)" }
  );
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  const box     = document.getElementById("modal-box");
  gsap.to(box, {
    duration: 0.2,
    opacity: 0,
    scale: 0.9,
    y: 20,
    onComplete: () => overlay.classList.add("hidden"),
  });
}

// ── SCREEN TRANSITIONS ──
export function showScreen(screenId, direction = "right") {
  const screens = document.querySelectorAll(".screen");
  const target  = document.getElementById(screenId);
  if (!target) return;

  const xIn  = direction === "right" ? "100%" : "-100%";
  const xOut = direction === "right" ? "-30%" : "30%";

  screens.forEach((s) => {
    if (s !== target && s.style.display !== "none") {
      gsap.to(s, {
        duration: 0.4,
        x: xOut,
        opacity: 0,
        ease: "power3.in",
        onComplete: () => {
          s.style.display = "none";
          s.style.transform = "";
        },
      });
    }
  });

  target.style.display = "flex";
  target.style.opacity = "0";
  target.style.transform = `translateX(${xIn})`;

  gsap.to(target, {
    duration: 0.45,
    x: "0%",
    opacity: 1,
    ease: "power3.out",
  });
}

// ── AUTH STEP TRANSITIONS ──
export function showAuthStep(stepId, direction = "forward") {
  const steps = document.querySelectorAll(".auth-step");
  const target = document.getElementById(stepId);
  if (!target) return;

  const xIn  = direction === "forward" ? 40 : -40;
  const xOut = direction === "forward" ? -40 : 40;

  steps.forEach((s) => {
    if (s !== target && s.style.display !== "none") {
      gsap.to(s, {
        duration: 0.3,
        x: xOut,
        opacity: 0,
        ease: "power2.in",
        onComplete: () => {
          s.style.display = "none";
          s.style.transform = "";
          s.style.opacity = "";
        },
      });
    }
  });

  target.style.display = "block";
  gsap.fromTo(
    target,
    { x: xIn, opacity: 0 },
    { duration: 0.35, x: 0, opacity: 1, ease: "power2.out" }
  );
}

// ── TAB SWITCHING ──
let currentTab = "chats";

export function switchTab(tabName) {
  if (tabName === currentTab) return;

  const panels  = document.querySelectorAll(".tab-panel");
  const navBtns = document.querySelectorAll(".nav-btn");

  const targetPanel = document.getElementById(`tab-${tabName}`);
  const curPanel    = document.getElementById(`tab-${currentTab}`);

  // Determine slide direction (by DOM order)
  const tabOrder = ["chats", "games", "profile", "settings"];
  const curIdx   = tabOrder.indexOf(currentTab);
  const newIdx   = tabOrder.indexOf(tabName);
  const dir      = newIdx > curIdx ? 1 : -1;

  if (curPanel) {
    gsap.to(curPanel, {
      duration: 0.28,
      x: dir * -40,
      opacity: 0,
      ease: "power2.in",
      onComplete: () => {
        curPanel.style.display = "none";
        curPanel.style.transform = "";
        curPanel.style.opacity = "";
      },
    });
  }

  if (targetPanel) {
    targetPanel.style.display = "block";
    gsap.fromTo(
      targetPanel,
      { x: dir * 40, opacity: 0 },
      { duration: 0.32, x: 0, opacity: 1, ease: "power2.out" }
    );
  }

  navBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  currentTab = tabName;
}

// ── LOADING STATE FOR BUTTONS ──
export function setButtonLoading(btn, loading, originalText = null) {
  if (!btn) return;
  if (loading) {
    btn._originalContent = btn.innerHTML;
    btn.innerHTML = `<div class="loader-ring" style="width:18px;height:18px;border-width:2px;"></div>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = originalText || btn._originalContent || btn.innerHTML;
    btn.disabled = false;
  }
}

// ── CHAT BUBBLE ANIMATION ──
export function animateBubbleIn(el) {
  gsap.fromTo(
    el,
    { opacity: 0, scale: 0.8, y: 10 },
    { duration: 0.22, opacity: 1, scale: 1, y: 0, ease: "back.out(1.6)" }
  );
}

// ── FAB ANIMATION ──
export function pulseFAB() {
  const fab = document.getElementById("fab-new-chat");
  if (!fab) return;
  gsap.fromTo(
    fab,
    { scale: 1 },
    { scale: 1.18, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.inOut" }
  );
}

// ── INIT NAV BUTTONS ──
export function initBottomNav(onTabChange) {
  const navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      if (onTabChange) onTabChange(tab);
    });
  });
}

// ── INIT SETTINGS TOGGLE ──
export function initSettingsToggle(toggleId, onChange) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const isOn = toggle.classList.toggle("on");
    if (onChange) onChange(isOn);
  });
}

// ── MESSAGE INPUT AUTO-RESIZE ──
export function initAutoResizeTextarea(textareaId) {
  const ta = document.getElementById(textareaId);
  if (!ta) return;
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  });
}

// ── SCROLL TO BOTTOM ──
export function scrollToBottom(containerId, smooth = true) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

// ═══════════════════════════════════════════════════════
// bot-utils.js  ·  Mystery Chat
// Telegram Bot API integration placeholder
// Reputation sync, admin notifications, future webhooks
// ═══════════════════════════════════════════════════════

// ── CONFIG ──
const BOT_TOKEN = "8709058432:AAEIqd4-owgpFyAdDOnqrG_mgsv5mJxaCJs";
const ADMIN_UID = "6226164273";
const API_BASE  = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── RATE LIMITER (in-memory) ──
const rateLimits = new Map();
function isRateLimited(key, cooldownMs = 5000) {
  const last = rateLimits.get(key) || 0;
  if (Date.now() - last < cooldownMs) return true;
  rateLimits.set(key, Date.now());
  return false;
}

// ══════════════════════════════════════════
// SEND MESSAGE TO TELEGRAM (via Bot API)
// ══════════════════════════════════════════
export async function sendTelegramMessage(chatId, text, parseMode = "HTML") {
  if (isRateLimited(`msg_${chatId}`, 2000)) {
    console.warn("[BotUtils] Rate limited:", chatId);
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return data.result;
  } catch (err) {
    console.error("[BotUtils] sendMessage error:", err);
    return null;
  }
}

// ══════════════════════════════════════════
// NOTIFY ADMIN
// ══════════════════════════════════════════
export async function notifyAdmin(eventType, payload = {}) {
  const lines = [
    `<b>🔮 Mystery Chat · ${eventType}</b>`,
    `<code>${JSON.stringify(payload, null, 2)}</code>`,
    `<i>Timestamp: ${new Date().toISOString()}</i>`,
  ];
  return sendTelegramMessage(ADMIN_UID, lines.join("\n\n"));
}

// ══════════════════════════════════════════
// REPUTATION SYNC STRUCTURE
// Syncs user reputation change to Telegram
// ══════════════════════════════════════════
export async function syncReputation({ username, delta, reason, newTotal }) {
  if (!username || delta === undefined) return;

  const sign    = delta > 0 ? "+" : "";
  const emoji   = delta > 0 ? "📈" : "📉";
  const message = [
    `${emoji} <b>Репутация обновлена</b>`,
    ``,
    `👤 Пользователь: <code>@${username}</code>`,
    `🔢 Изменение: <b>${sign}${delta}</b>`,
    `📊 Итого: <b>${newTotal}</b>`,
    `💬 Причина: ${reason || "не указана"}`,
  ].join("\n");

  return notifyAdmin("REP_SYNC", { username, delta, reason, newTotal });
}

// ══════════════════════════════════════════
// NEW USER REGISTRATION NOTIFICATION
// ══════════════════════════════════════════
export async function notifyNewUser(username) {
  if (!username) return;
  return notifyAdmin("NEW_USER", {
    username,
    registeredAt: new Date().toISOString(),
  });
}

// ══════════════════════════════════════════
// NEW MESSAGE NOTIFICATION (optional/future)
// ══════════════════════════════════════════
export async function notifyNewMessage({ from, to, preview }) {
  // This is intentionally a placeholder for future push-notification bridging
  // In production, this would be handled by a Cloud Function / webhook, not client-side
  console.info(`[BotUtils] Message from @${from} to @${to}: "${preview}"`);
  // return notifyAdmin("NEW_MESSAGE", { from, to, preview });
}

// ══════════════════════════════════════════
// WEBHOOK INFO (debug only)
// ══════════════════════════════════════════
export async function getBotInfo() {
  try {
    const res  = await fetch(`${API_BASE}/getMe`);
    const data = await res.json();
    if (data.ok) {
      console.info("[BotUtils] Bot info:", data.result);
      return data.result;
    }
  } catch (err) {
    console.warn("[BotUtils] Could not fetch bot info:", err);
  }
  return null;
}

// ══════════════════════════════════════════
// COMMAND STRUCTURE (for future webhook handler)
// Commands your bot will handle server-side
// ══════════════════════════════════════════
export const BOT_COMMANDS = {
  "/rep":    "Посмотреть репутацию пользователя",
  "/addrep": "Добавить репутацию [admin only]",
  "/subrep": "Снять репутацию [admin only]",
  "/ban":    "Заблокировать пользователя [admin only]",
  "/users":  "Список пользователей [admin only]",
  "/ping":   "Проверить бота",
};

// Export constants for other modules
export { BOT_TOKEN, ADMIN_UID };

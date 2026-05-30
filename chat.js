// ═══════════════════════════════════════════════════════
// chat.js · Mystery Chat v3
// Realtime chat · Message editing · Reactions · Context menu
// Peer profile · History clear · Search
// (File upload removed — Firestore Spark free plan only)
// ═══════════════════════════════════════════════════════
import { firestore } from "./firebase-config.js";
import { session } from "./auth.js";
import {
  showToast, showScreen, showModal, animateBubbleIn,
  scrollToBottom, openPeerPanel, closePeerPanel,
} from "./ui-animations.js";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  startAt, endAt, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── State ──
let activeConvId   = null;
let activePeer     = null;
let activePeerName = null;
let msgsUnsub      = null;
let chatListUnsub  = null;
let ctxMsgId       = null;
let ctxMsgData     = null;
let longPressTimer = null;
let searchTimer    = null;
let deletedForMe   = new Set();

export const getAvatarUrl = u => `https://minotar.net/helm/${encodeURIComponent(u || "MHF_Steve")}/100.png`;
export const buildConvId  = (a, b) => [a, b].sort().join("__");

// ════════════════════════════════════
// INIT
// ════════════════════════════════════
export function initChat() {
  initChatList();
  initChatViewButtons();
  initContextMenu();
  initSearchOverlay();
}

// ════════════════════════════════════
// CHAT LIST
// ════════════════════════════════════
function initChatList() {
  const listEl  = document.getElementById("chat-list");
  const emptyEl = document.getElementById("chats-empty");
  if (!listEl) return;

  if (chatListUnsub) chatListUnsub();

  const q = query(
    collection(firestore, "conversations"),
    where("members", "array-contains", session.username),
    orderBy("updatedAt", "desc"),
    limit(60)
  );

  chatListUnsub = onSnapshot(q, async snap => {
    listEl.innerHTML = "";
    if (snap.empty) { emptyEl?.classList.remove("hidden"); return; }
    emptyEl?.classList.add("hidden");

    const rows = await Promise.all(snap.docs.map(async d => {
      const data  = d.data();
      const peer  = data.members?.find(m => m !== session.username);
      if (!peer) return null;

      let peerName = peer, peerAvatar = null;
      try {
        const pd = await getDoc(doc(firestore, "users", peer));
        if (pd.exists()) {
          peerName   = pd.data().displayName || peer;
          peerAvatar = pd.data().avatarUrl   || null;
        }
      } catch (_) {}

      return {
        id: d.id, peer, peerName, peerAvatar,
        lastMessage: data.lastMessage || "",
        lastSender:  data.lastSender  || "",
        updatedAt:   data.updatedAt,
        unread:      data.unreadCount?.[session.username] || 0,
      };
    }));

    rows.filter(Boolean).forEach((chat, i) => {
      const el = buildChatListItem(chat);
      listEl.appendChild(el);
      gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .2, delay: i * .035 });
    });
  }, err => console.error("[ChatList]", err));
}

function buildChatListItem(chat) {
  const el        = document.createElement("div");
  el.className    = "chat-item";
  el.dataset.peer = chat.peer;
  const time       = chat.updatedAt ? fmtTime(chat.updatedAt.toDate?.() ?? new Date()) : "";
  const previewRaw = chat.lastMessage
    ? (chat.lastSender === session.username ? `Вы: ${chat.lastMessage}` : chat.lastMessage)
    : "Нажми чтобы начать";
  const avatarSrc  = chat.peerAvatar || getAvatarUrl(chat.peer);

  el.innerHTML = `
    <div class="chat-item-avatar">
      <img src="${esc(avatarSrc)}" alt="" loading="lazy"
        onerror="this.src='${getAvatarUrl("MHF_Steve")}'" />
    </div>
    <div class="chat-item-body">
      <div class="chat-item-top">
        <div class="chat-item-name">${esc(chat.peerName)}</div>
        <div class="chat-item-time">${esc(time)}</div>
      </div>
      <div class="chat-item-preview ${chat.unread > 0 ? "unread-preview" : ""}">${esc(trunc(previewRaw, 44))}</div>
    </div>
    <div class="chat-item-right">
      ${chat.unread > 0 ? `<div class="chat-item-badge">${chat.unread > 99 ? "99+" : chat.unread}</div>` : ""}
    </div>`;

  el.addEventListener("click", () => openChat(chat.peer, chat.peerName, chat.peerAvatar));
  return el;
}

// ════════════════════════════════════
// OPEN CHAT
// ════════════════════════════════════
export async function openChat(peerUsername, peerDisplayName, peerAvatarUrl) {
  activePeer     = peerUsername;
  activePeerName = peerDisplayName || peerUsername;
  activeConvId   = buildConvId(session.username, peerUsername);
  deletedForMe.clear();

  const avatarSrc = peerAvatarUrl || getAvatarUrl(peerUsername);
  const nameEl    = document.getElementById("chat-peer-name");
  const avatarEl  = document.getElementById("chat-peer-avatar");
  const statusEl  = document.getElementById("chat-peer-status");

  if (nameEl)   nameEl.textContent = activePeerName;
  if (avatarEl) { avatarEl.src = avatarSrc; avatarEl.onerror = () => { avatarEl.src = getAvatarUrl("MHF_Steve"); }; }

  // Fetch peer status
  try {
    const pd = await getDoc(doc(firestore, "users", peerUsername));
    if (pd.exists() && statusEl) {
      const d = pd.data();
      if (d.online) {
        statusEl.textContent = "в сети";
        statusEl.style.color = "var(--accent-2)";
      } else if (d.lastSeen) {
        statusEl.textContent = `был(а) ${fmtRelative(d.lastSeen.toDate?.() ?? new Date())}`;
        statusEl.style.color = "";
      }
    }
  } catch (_) {}

  // Ensure conversation doc exists
  const convRef = doc(firestore, "conversations", activeConvId);
  const convSnap = await getDoc(convRef).catch(() => null);
  if (!convSnap?.exists()) {
    await setDoc(convRef, {
      members: [session.username, peerUsername],
      lastMessage: "", lastSender: "",
      updatedAt: serverTimestamp(),
      unreadCount: { [session.username]: 0, [peerUsername]: 0 },
    });
  }
  // Clear my unread
  await updateDoc(convRef, { [`unreadCount.${session.username}`]: 0 }).catch(() => {});

  showScreen("screen-chat", "right");

  // Stop old listener
  if (msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
  const msgList  = document.getElementById("messages-list");
  const msgEmpty = document.getElementById("messages-empty");
  if (msgList) msgList.innerHTML = "";

  // Restore locally-deleted ids
  try {
    const raw = localStorage.getItem(`del_me_${activeConvId}_${session.username}`);
    if (raw) JSON.parse(raw).forEach(id => deletedForMe.add(id));
  } catch (_) {}

  // Subscribe
  const msgsQ = query(
    collection(firestore, "conversations", activeConvId, "messages"),
    orderBy("createdAt", "asc"),
    limit(400)
  );

  let firstLoad = true;
  msgsUnsub = onSnapshot(msgsQ, snap => {
    if (firstLoad) {
      firstLoad = false;
      msgList.innerHTML = "";
      let lastDate = null;
      snap.docs.forEach(d => {
        const msg = { id: d.id, ...d.data() };
        if (msg.deletedForAll) return;
        if (deletedForMe.has(d.id)) return;
        const dt = msg.createdAt?.toDate?.() ?? new Date();
        const dk = dt.toDateString();
        if (dk !== lastDate) { lastDate = dk; msgList.appendChild(mkDateSep(dt)); }
        msgList.appendChild(buildMsgRow(msg));
      });
      scrollToBottom("messages-container", false);
      if (msgEmpty) msgEmpty.style.display = snap.empty ? "flex" : "none";
    } else {
      snap.docChanges().forEach(change => {
        const msg = { id: change.doc.id, ...change.doc.data() };

        if (change.type === "added") {
          if (msg.deletedForAll || deletedForMe.has(msg.id)) return;
          if (msgEmpty) msgEmpty.style.display = "none";
          const row = buildMsgRow(msg);
          animateBubbleIn(row);
          msgList.appendChild(row);
          scrollToBottom("messages-container", true);
        }

        if (change.type === "modified") {
          // Refresh the row in-place (reactions, edit, delete)
          const existingRow = msgList.querySelector(`.msg-row[data-msgid="${msg.id}"]`);
          if (existingRow) {
            if (msg.deletedForAll) { existingRow.remove(); return; }
            const fresh = buildMsgRow(msg);
            existingRow.replaceWith(fresh);
          }
        }

        if (change.type === "removed") {
          msgList.querySelector(`.msg-row[data-msgid="${change.doc.id}"]`)?.remove();
        }
      });
    }
  }, err => console.error("[Messages]", err));
}

// ════════════════════════════════════
// BUILD MESSAGE ROW
// ════════════════════════════════════
function buildMsgRow(msg) {
  const isMine = msg.sender === session.username;
  const row    = document.createElement("div");
  row.className = `msg-row ${isMine ? "out" : "in"}`;
  row.dataset.msgid = msg.id;

  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${isMine ? "out" : "in"}`;

  const dt      = msg.createdAt?.toDate?.() ?? new Date();
  const timeStr = dt.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  // Content
  let contentHtml = "";
  if (msg.deletedForAll) {
    contentHtml = `<div class="message-text" style="color:var(--text-muted);font-style:italic;">Сообщение удалено</div>`;
  } else {
    contentHtml = `<div class="message-text">${escNL(msg.text || "")}</div>`;
  }

  bubble.innerHTML = `
    ${contentHtml}
    <div class="message-meta">
      <span class="message-time">${timeStr}</span>
      ${msg.edited ? `<span class="message-edited">изменено</span>` : ""}
      ${isMine ? `<span class="message-status">✓✓</span>` : ""}
    </div>`;

  row.appendChild(bubble);

  // Reaction bar
  row.appendChild(buildReactionBar(msg.id, msg.reactions || {}));

  // Interactions
  setupMsgInteractions(bubble, msg);

  return row;
}

function buildReactionBar(msgId, reactions) {
  const bar = document.createElement("div");
  bar.className = "reaction-bar";

  const counts = {};
  Object.entries(reactions).forEach(([user, emoji]) => {
    if (!counts[emoji]) counts[emoji] = [];
    counts[emoji].push(user);
  });

  Object.entries(counts).forEach(([emoji, users]) => {
    const pill = document.createElement("div");
    pill.className = `reaction-pill${users.includes(session.username) ? " mine" : ""}`;
    pill.innerHTML = `${emoji}<span class="reaction-count">${users.length}</span>`;
    pill.title     = users.join(", ");
    pill.addEventListener("click", () => toggleReaction(msgId, emoji));
    bar.appendChild(pill);
  });

  return bar;
}

function setupMsgInteractions(bubble, msg) {
  // Long press → context menu
  bubble.addEventListener("pointerdown", e => {
    longPressTimer = setTimeout(() => {
      showCtxMenu(e.clientX, e.clientY, msg.id, msg);
    }, 500);
  });
  bubble.addEventListener("pointerup",    () => clearTimeout(longPressTimer));
  bubble.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
  bubble.addEventListener("contextmenu",  e => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    showCtxMenu(e.clientX, e.clientY, msg.id, msg);
  });

  // Double-click → ❤️
  bubble.addEventListener("dblclick", () => toggleReaction(msg.id, "❤️"));
}

// ════════════════════════════════════
// REACTIONS
// ════════════════════════════════════
async function toggleReaction(msgId, emoji) {
  if (!activeConvId || !msgId) return;
  try {
    const ref  = doc(firestore, "conversations", activeConvId, "messages", msgId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const reactions = { ...(snap.data().reactions || {}) };
    if (reactions[session.username] === emoji) {
      delete reactions[session.username];
    } else {
      reactions[session.username] = emoji;
    }
    await updateDoc(ref, { reactions });
  } catch (e) { console.error("[Reaction]", e); }
}

// ════════════════════════════════════
// CONTEXT MENU
// ════════════════════════════════════
function initContextMenu() {
  const menu = document.getElementById("msg-ctx-menu");
  if (!menu) return;

  menu.querySelectorAll(".ctx-emoji").forEach(btn => {
    btn.addEventListener("click", () => {
      if (ctxMsgId) toggleReaction(ctxMsgId, btn.dataset.emoji);
      hideCtxMenu();
    });
  });

  document.getElementById("ctx-copy")?.addEventListener("click", () => {
    if (ctxMsgData?.text) {
      navigator.clipboard?.writeText(ctxMsgData.text)
        .then(() => showToast("Скопировано", "success"))
        .catch(() => showToast("Ошибка копирования", "error"));
    }
    hideCtxMenu();
  });

  document.getElementById("ctx-edit")?.addEventListener("click", () => {
    if (ctxMsgId && ctxMsgData?.sender === session.username) {
      enterEditMode(ctxMsgId, ctxMsgData.text || "");
    }
    hideCtxMenu();
  });

  document.getElementById("ctx-del-me")?.addEventListener("click", () => {
    deleteForMe_local(ctxMsgId);
    hideCtxMenu();
  });

  document.getElementById("ctx-del-all")?.addEventListener("click", () => {
    if (ctxMsgData?.sender !== session.username) {
      showToast("Только своё сообщение можно удалить у всех", "error");
      hideCtxMenu();
      return;
    }
    deleteForAll_firestore(ctxMsgId);
    hideCtxMenu();
  });

  // Close on outside tap
  document.addEventListener("click", e => {
    if (!menu.contains(e.target)) hideCtxMenu();
  }, true);
}

function showCtxMenu(x, y, msgId, msgData) {
  ctxMsgId   = msgId;
  ctxMsgData = msgData;
  const menu = document.getElementById("msg-ctx-menu");
  if (!menu) return;

  menu.classList.remove("hidden");

  const mw = 200, mh = 220;
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth  - mw - 8))}px`;
  menu.style.top  = `${Math.max(8, Math.min(y, window.innerHeight - mh - 8))}px`;

  // Highlight existing reaction
  const existing = msgData.reactions?.[session.username];
  menu.querySelectorAll(".ctx-emoji").forEach(btn =>
    btn.classList.toggle("active-reaction", btn.dataset.emoji === existing)
  );

  // Show edit/delete-all only for own messages
  const isMine = msgData.sender === session.username;
  const editEl = document.getElementById("ctx-edit");
  if (editEl) editEl.style.display = isMine && !msgData.deletedForAll ? "" : "none";
  const delAll = document.getElementById("ctx-del-all");
  if (delAll) delAll.style.display = isMine ? "" : "none";

  gsap.fromTo(menu,
    { opacity: 0, scale: .86, y: -8 },
    { opacity: 1, scale: 1, y: 0, duration: .18, ease: "back.out(1.6)" }
  );
}

function hideCtxMenu() {
  const menu = document.getElementById("msg-ctx-menu");
  if (!menu || menu.classList.contains("hidden")) return;
  gsap.to(menu, {
    opacity: 0, scale: .9, duration: .14, ease: "power2.in",
    onComplete: () => menu.classList.add("hidden"),
  });
  ctxMsgId = null; ctxMsgData = null;
}

// ════════════════════════════════════
// MESSAGE EDITING (inline, like TG)
// ════════════════════════════════════
function enterEditMode(msgId, currentText) {
  const bubble = document.querySelector(`.message-bubble[data-msgid="${msgId}"]`);
  if (!bubble) {
    // data-msgid is on the row itself in our current structure
    const row = document.querySelector(`.msg-row[data-msgid="${msgId}"]`);
    if (!row) return;
    enterEditOnBubble(row.querySelector(".message-bubble"), msgId, currentText);
    return;
  }
  enterEditOnBubble(bubble, msgId, currentText);
}

function enterEditOnBubble(bubble, msgId, currentText) {
  if (!bubble) return;

  // Save original content
  const originalHTML = bubble.innerHTML;

  // Replace bubble content with editor
  bubble.innerHTML = `
    <div class="msg-edit-wrap">
      <textarea class="msg-edit-ta" id="edit-ta-${msgId}">${escHTML(currentText)}</textarea>
      <div class="msg-edit-actions">
        <button class="msg-edit-btn msg-edit-cancel" id="edit-cancel-${msgId}">Отмена</button>
        <button class="msg-edit-btn msg-edit-save" id="edit-save-${msgId}">Сохранить</button>
      </div>
    </div>`;

  const ta = document.getElementById(`edit-ta-${msgId}`);
  if (ta) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; });
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById(`edit-save-${msgId}`)?.click(); }
      if (e.key === "Escape") { document.getElementById(`edit-cancel-${msgId}`)?.click(); }
    });
  }

  document.getElementById(`edit-cancel-${msgId}`)?.addEventListener("click", () => {
    bubble.innerHTML = originalHTML;
  });

  document.getElementById(`edit-save-${msgId}`)?.addEventListener("click", async () => {
    const newText = ta?.value?.trim();
    if (!newText) { showToast("Сообщение не может быть пустым", "error"); return; }
    if (newText === currentText) { bubble.innerHTML = originalHTML; return; }
    try {
      await updateDoc(doc(firestore, "conversations", activeConvId, "messages", msgId), {
        text: newText, edited: true,
      });
      showToast("Изменено ✓", "success");
    } catch (e) {
      console.error(e); showToast("Ошибка редактирования", "error");
      bubble.innerHTML = originalHTML;
    }
  });
}

// ════════════════════════════════════
// DELETE
// ════════════════════════════════════
function deleteForMe_local(msgId) {
  if (!msgId) return;
  deletedForMe.add(msgId);
  try {
    localStorage.setItem(
      `del_me_${activeConvId}_${session.username}`,
      JSON.stringify([...deletedForMe])
    );
  } catch (_) {}
  const row = document.querySelector(`.msg-row[data-msgid="${msgId}"]`);
  if (row) gsap.to(row, { opacity: 0, height: 0, marginBottom: 0, duration: .22, onComplete: () => row.remove() });
  showToast("Удалено у тебя", "success");
}

async function deleteForAll_firestore(msgId) {
  if (!msgId) return;
  try {
    await updateDoc(doc(firestore, "conversations", activeConvId, "messages", msgId), {
      deletedForAll: true, text: "", reactions: {},
    });
    showToast("Удалено у всех", "success");
  } catch (e) {
    console.error(e); showToast("Ошибка удаления", "error");
  }
}

// ════════════════════════════════════
// CLEAR HISTORY
// ════════════════════════════════════
export async function clearHistory(forBoth = false) {
  if (!activeConvId) return;
  try {
    if (forBoth) {
      const snap  = await getDocs(collection(firestore, "conversations", activeConvId, "messages"));
      const batch = writeBatch(firestore);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.update(doc(firestore, "conversations", activeConvId), {
        lastMessage: "", lastSender: "",
      });
      await batch.commit();
      document.getElementById("messages-list").innerHTML = "";
      document.getElementById("messages-empty").style.display = "flex";
      showToast("История очищена у обоих", "success");
    } else {
      const snap = await getDocs(
        query(collection(firestore, "conversations", activeConvId, "messages"),
          orderBy("createdAt"), limit(500))
      );
      snap.docs.forEach(d => deletedForMe.add(d.id));
      localStorage.setItem(
        `del_me_${activeConvId}_${session.username}`,
        JSON.stringify([...deletedForMe])
      );
      document.getElementById("messages-list").innerHTML = "";
      document.getElementById("messages-empty").style.display = "flex";
      showToast("История очищена у тебя", "success");
    }
  } catch (e) {
    console.error(e); showToast("Ошибка очистки", "error");
  }
}

// ════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════
export async function sendMessage(text) {
  if (!text?.trim() || !activeConvId) return;
  const trimmed = text.trim();
  try {
    await addDoc(collection(firestore, "conversations", activeConvId, "messages"), {
      text: trimmed, sender: session.username,
      type: "text", createdAt: serverTimestamp(), reactions: {}, edited: false,
    });
    const unread = await getUnread(activePeer);
    await updateDoc(doc(firestore, "conversations", activeConvId), {
      lastMessage: trimmed, lastSender: session.username,
      updatedAt: serverTimestamp(),
      [`unreadCount.${activePeer}`]: unread + 1,
    });
  } catch (e) {
    console.error(e); showToast("Не удалось отправить", "error");
  }
}

async function getUnread(peer) {
  try {
    const s = await getDoc(doc(firestore, "conversations", activeConvId));
    return s.data()?.unreadCount?.[peer] || 0;
  } catch (_) { return 0; }
}

// ════════════════════════════════════
// CHAT VIEW BUTTONS
// ════════════════════════════════════
function initChatViewButtons() {
  const $ = id => document.getElementById(id);

  $("btn-back-chat")?.addEventListener("click", () => {
    if (msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
    showScreen("screen-main", "left");
  });

  $("btn-send-message")?.addEventListener("click", () => {
    const ta = $("message-input");
    const text = ta?.value || "";
    if (!text.trim()) return;
    sendMessage(text);
    ta.value = "";
    ta.style.height = "auto";
  });

  $("message-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("btn-send-message")?.click();
    }
  });

  // Click peer avatar/name → peer profile
  $("chat-header-info")?.addEventListener("click", () => openPeerProfilePanel(activePeer));

  // Chat options (⋮)
  $("btn-chat-options")?.addEventListener("click", () => {
    showModal({
      title: `Чат с @${activePeer}`,
      body: "",
      actions: [
        {
          label: "Очистить у меня",
          className: "modal-btn--ghost",
          onClick: () => showModal({
            title: "Очистить историю",
            body: "Удалить все сообщения только у тебя?",
            actions: [
              { label: "Удалить у меня", className: "modal-btn--danger", onClick: () => clearHistory(false) },
              { label: "Отмена", className: "modal-btn--ghost" },
            ],
          }),
        },
        {
          label: "Очистить у всех",
          className: "modal-btn--danger",
          onClick: () => showModal({
            title: "Очистить у обоих",
            body: "Сообщения удалятся для обоих участников чата.",
            actions: [
              { label: "Удалить у всех", className: "modal-btn--danger", onClick: () => clearHistory(true) },
              { label: "Отмена", className: "modal-btn--ghost" },
            ],
          }),
        },
        { label: "Закрыть", className: "modal-btn--ghost" },
      ],
    });
  });

  $("btn-close-peer-panel")?.addEventListener("click", closePeerPanel);
}

// ════════════════════════════════════
// PEER PROFILE PANEL
// ════════════════════════════════════
export async function openPeerProfilePanel(username) {
  if (!username) return;
  openPeerPanel();
  const $ = id => document.getElementById(id);

  try {
    const snap = await getDoc(doc(firestore, "users", username));
    const data  = snap.exists() ? snap.data() : {};
    const avSrc = data.avatarUrl || getAvatarUrl(username);

    const imgEl = $("pp-avatar");
    if (imgEl) { imgEl.src = avSrc; imgEl.onerror = () => { imgEl.src = getAvatarUrl("MHF_Steve"); }; }
    setText("pp-name", data.displayName || username);
    setText("pp-tag",  `@${username}`);

    const statusEl = $("pp-status");
    if (statusEl) {
      if (data.online) {
        statusEl.innerHTML = `<span class="status-dot"></span><span>В сети</span>`;
      } else if (data.lastSeen) {
        const dt = data.lastSeen.toDate?.() ?? new Date();
        statusEl.innerHTML = `<span style="color:var(--text-muted)">был(а) ${fmtRelative(dt)}</span>`;
      }
    }

    setText("pp-bio", data.bio || "Нет информации о себе");

    if (data.createdAt) {
      const dt = data.createdAt.toDate?.() ?? new Date();
      setText("pp-stat-joined", dt.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" }));
    }

    // Reputation
    const rep   = data.rep || 0;
    const repEl = $("pp-rep-count");
    if (repEl) {
      if (rep > 0)      { repEl.textContent = `+${rep}`; repEl.className = "pp-rep-count positive"; }
      else if (rep < 0) { repEl.textContent = `${rep}`;  repEl.className = "pp-rep-count negative"; }
      else              { repEl.textContent = "";         repEl.className = "pp-rep-count"; }
    }

    setupRepButtons(username, rep);
    loadPeerStats(username);

    const btnMsg = $("btn-pp-message");
    if (btnMsg) {
      btnMsg.onclick = () => {
        closePeerPanel();
        openChat(username, data.displayName || username, data.avatarUrl || null);
      };
    }
  } catch (e) { console.error("[PeerPanel]", e); }
}

async function loadPeerStats(username) {
  try {
    const q    = query(collection(firestore, "conversations"), where("members", "array-contains", username));
    const snap = await getDocs(q);
    setText("pp-stat-chats", snap.size);
    let total = 0;
    await Promise.all(snap.docs.map(async d => {
      const ms = await getDocs(
        query(collection(firestore, "conversations", d.id, "messages"), where("sender", "==", username))
      );
      total += ms.size;
    }));
    setText("pp-stat-msg", total);
  } catch (_) {}
}

function setupRepButtons(username, currentRep) {
  const plus  = document.getElementById("pp-rep-plus");
  const minus = document.getElementById("pp-rep-minus");
  const repEl = document.getElementById("pp-rep-count");
  const key   = `repvote_${session.username}_to_${username}`;

  const refresh = rep => {
    if (!repEl) return;
    if (rep > 0)      { repEl.textContent = `+${rep}`; repEl.className = "pp-rep-count positive"; }
    else if (rep < 0) { repEl.textContent = `${rep}`;  repEl.className = "pp-rep-count negative"; }
    else              { repEl.textContent = "";         repEl.className = "pp-rep-count"; }
  };

  const vote = async delta => {
    const last = parseInt(localStorage.getItem(key + "_t") || "0");
    if (Date.now() - last < 24 * 3600 * 1000) {
      showToast("Голосовать можно раз в 24 ч", "error"); return;
    }
    try {
      const snap = await getDoc(doc(firestore, "users", username));
      const newRep = (snap.data()?.rep || 0) + delta;
      await updateDoc(doc(firestore, "users", username), { rep: newRep });
      localStorage.setItem(key,        delta > 0 ? "+1" : "-1");
      localStorage.setItem(key + "_t", Date.now().toString());
      refresh(newRep);
      showToast(delta > 0 ? `Репутация @${username} +1 ✓` : `Репутация @${username} -1`, delta > 0 ? "success" : "info");
    } catch (e) { console.error(e); showToast("Ошибка", "error"); }
  };

  plus?.addEventListener("click",  () => vote(+1));
  minus?.addEventListener("click", () => vote(-1));
}

// ════════════════════════════════════
// SEARCH OVERLAY
// ════════════════════════════════════
function initSearchOverlay() {
  const input  = document.getElementById("search-overlay-input");
  const clearB = document.getElementById("btn-clear-overlay-search");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearB?.classList.toggle("hidden", !q);
    clearTimeout(searchTimer);
    if (!q) { resetSearch(); return; }
    searchTimer = setTimeout(() => searchUsers(q), 220);
  });

  clearB?.addEventListener("click", () => {
    input.value = ""; clearB.classList.add("hidden");
    resetSearch(); input.focus();
  });
}

function resetSearch() {
  const res = document.getElementById("search-overlay-results");
  if (res) res.innerHTML = `
    <div class="search-overlay-hint">
      <i data-lucide="users" width="32" height="32"></i>
      <p>Начни вводить имя пользователя</p>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

async function searchUsers(queryStr) {
  const res = document.getElementById("search-overlay-results");
  if (!res) return;
  res.innerHTML = `<div class="search-overlay-hint"><p style="color:var(--text-muted)">Поиск...</p></div>`;

  const qLow = queryStr.toLowerCase().trim();
  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(firestore, "users"), orderBy("username"), startAt(qLow), endAt(qLow + "\uf8ff"), limit(25))),
      getDocs(query(collection(firestore, "users"), limit(200))),
    ]);
    const map = new Map();
    snap1.docs.forEach(d => { if (d.id !== session.username) map.set(d.id, d.data()); });
    snap2.docs.forEach(d => {
      if (d.id === session.username) return;
      const dn = (d.data().displayName || "").toLowerCase();
      if (dn.includes(qLow) && !map.has(d.id)) map.set(d.id, d.data());
    });

    renderSearchResults([...map.entries()].map(([id, data]) => ({ id, ...data })), queryStr);
  } catch (e) {
    console.error(e);
    res.innerHTML = `<div class="search-overlay-hint"><p style="color:var(--text-danger)">Ошибка поиска</p></div>`;
  }
}

function renderSearchResults(users, query) {
  const res = document.getElementById("search-overlay-results");
  if (!res) return;
  res.innerHTML = "";

  if (!users.length) {
    res.innerHTML = `<div class="search-overlay-hint"><i data-lucide="search-x" width="32" height="32"></i><p>Не найдено</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const label = document.createElement("div");
  label.className = "search-section-label";
  label.textContent = `Пользователи (${users.length})`;
  res.appendChild(label);

  users.forEach((user, i) => {
    const item      = document.createElement("div");
    item.className  = "search-result-item";
    const username  = user.username || user.id;
    const dname     = user.displayName || username;
    const avSrc     = user.avatarUrl || getAvatarUrl(username);

    item.innerHTML = `
      <div class="search-result-avatar">
        <img src="${esc(avSrc)}" loading="lazy" onerror="this.src='${getAvatarUrl("MHF_Steve")}'" />
      </div>
      <div class="search-result-info">
        <div class="search-result-name">${esc(dname)}</div>
        <div class="search-result-tag">@${hlMatch(username, query)}</div>
      </div>`;

    item.addEventListener("click", () => {
      import("./ui-animations.js").then(({ closeSearchOverlay }) => closeSearchOverlay());
      openChat(username, dname, user.avatarUrl || null);
    });

    res.appendChild(item);
    gsap.fromTo(item, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .18, delay: i * .03 });
  });
}

// ════════════════════════════════════
// POPULATE PROFILE UI
// ════════════════════════════════════
export function populateProfileUI(userData) {
  const avSrc = userData.avatarUrl || getAvatarUrl(userData.username);

  // Settings card
  const sa = document.getElementById("settings-avatar");
  if (sa) sa.innerHTML = `<img src="${esc(avSrc)}" onerror="this.src='${getAvatarUrl("MHF_Steve")}'" />`;
  setText("settings-display-name", userData.displayName || userData.username);
  setText("settings-username",     `@${userData.username}`);

  // Profile tab
  const pi = document.getElementById("profile-avatar-img");
  if (pi) { pi.src = avSrc; pi.onerror = () => { pi.src = getAvatarUrl("MHF_Steve"); }; }
  setText("profile-name", userData.displayName || userData.username);
  setText("profile-tag",  `@${userData.username}`);
  setText("profile-bio",  userData.bio || "Тайна окутывает всё...");

  // Reputation colour
  const repEl = document.getElementById("stat-rep");
  if (repEl) {
    const rep = userData.rep || 0;
    if (rep > 0)      { repEl.textContent = `+${rep}`; repEl.className = "stat-value positive"; }
    else if (rep < 0) { repEl.textContent = `${rep}`;  repEl.className = "stat-value negative"; }
    else              { repEl.textContent = "—";        repEl.className = "stat-value"; }
  }

  loadMyStats(userData.username);
}

async function loadMyStats(username) {
  try {
    const q    = query(collection(firestore, "conversations"), where("members", "array-contains", username));
    const snap = await getDocs(q);
    setText("stat-chats", snap.size);
    let total = 0;
    await Promise.all(snap.docs.map(async d => {
      const ms = await getDocs(
        query(collection(firestore, "conversations", d.id, "messages"), where("sender", "==", username))
      );
      total += ms.size;
    }));
    setText("stat-messages", total);
  } catch (_) {}
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════
function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escHTML(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function escNL(s) {
  return esc(s).replace(/\n/g, "<br>");
}
function trunc(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function hlMatch(text, search) {
  const i = text.toLowerCase().indexOf(search.toLowerCase());
  if (i === -1) return esc(text);
  return esc(text.slice(0,i)) + `<span class="highlight">${esc(text.slice(i,i+search.length))}</span>` + esc(text.slice(i+search.length));
}
function fmtTime(d) {
  const now = new Date(), diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 86400000) return d.toLocaleDateString("ru", { weekday: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}
function fmtRelative(d) {
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 1)  return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h/24)} дн назад`;
}
function mkDateSep(date) {
  const el = document.createElement("div");
  el.className = "date-separator";
  el.textContent = date.toLocaleDateString("ru", { day: "numeric", month: "long" });
  return el;
}

export { activePeer, activePeerName, activeConvId };

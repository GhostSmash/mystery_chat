// ═══════════════════════════════════════════════════════
// chat.js  ·  Mystery Chat
// Real-time chat, Firestore messaging, Telegram-style
// user search with letter highlight, chat list
// ═══════════════════════════════════════════════════════

import { firestore }    from "./firebase-config.js";
import { session }      from "./auth.js";
import { showToast, showScreen, showModal, animateBubbleIn, scrollToBottom, pulseFAB } from "./ui-animations.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  startAt,
  endAt,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── STATE ──
let activeConversationId = null;
let activePeerUsername   = null;
let messagesListener     = null;
let chatListListener     = null;
let searchDebounceTimer  = null;

// ── AVATAR URL HELPER ──
export function getAvatarUrl(username) {
  return `https://minotar.net/helm/${username}/100.png`;
}

// ── CONVERSATION ID (sorted to be symmetric) ──
function buildConversationId(user1, user2) {
  return [user1, user2].sort().join("__");
}

// ════════════════════════════════════════════
// INIT ALL CHAT FUNCTIONALITY
// ════════════════════════════════════════════
export function initChat() {
  initSearch();
  initFAB();
  initChatViewButtons();
  loadChatList();
}

// ═══════════════════
// 1. SEARCH
// ═══════════════════
function initSearch() {
  const searchInput   = document.getElementById("chat-search-input");
  const clearBtn      = document.getElementById("btn-clear-search");
  const resultsPanel  = document.getElementById("search-results-panel");

  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    clearBtn.classList.toggle("hidden", !q);

    clearTimeout(searchDebounceTimer);
    if (!q) {
      resultsPanel.classList.add("hidden");
      return;
    }
    searchDebounceTimer = setTimeout(() => searchUsers(q), 220);
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.classList.add("hidden");
    resultsPanel.classList.add("hidden");
    searchInput.focus();
  });
}

async function searchUsers(queryStr) {
  const resultsPanel = document.getElementById("search-results-panel");
  const resultsList  = document.getElementById("search-results-list");
  if (!resultsPanel || !resultsList) return;

  const qLower = queryStr.toLowerCase().trim();
  if (!qLower) return;

  resultsList.innerHTML = `<div style="padding:12px 16px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">Поиск...</div>`;
  resultsPanel.classList.remove("hidden");

  try {
    // Firestore prefix search (range query on username field)
    const usersRef = collection(firestore, "users");
    const qSnap = await getDocs(
      query(
        usersRef,
        orderBy("username"),
        startAt(qLower),
        endAt(qLower + "\uf8ff"),
        limit(20)
      )
    );

    const users = [];
    qSnap.forEach((d) => {
      if (d.id !== session.username) {
        users.push({ id: d.id, ...d.data() });
      }
    });

    // Also do displayName search (client-side fallback on same results)
    // (Firestore doesn't support LIKE, so we fetch and filter)
    const allSnap = await getDocs(query(usersRef, limit(200)));
    allSnap.forEach((d) => {
      if (d.id !== session.username) {
        const data = d.data();
        const dn   = (data.displayName || "").toLowerCase();
        if (dn.includes(qLower) && !users.find((u) => u.id === d.id)) {
          users.push({ id: d.id, ...data });
        }
      }
    });

    renderSearchResults(users, queryStr);
  } catch (err) {
    console.error("[Search] Error:", err);
    resultsList.innerHTML = `<div style="padding:12px 16px;font-family:var(--font-mono);font-size:12px;color:var(--text-danger);">Ошибка поиска</div>`;
  }
}

function renderSearchResults(users, queryStr) {
  const resultsPanel = document.getElementById("search-results-panel");
  const resultsList  = document.getElementById("search-results-list");
  if (!resultsList) return;

  if (users.length === 0) {
    resultsList.innerHTML = `<div style="padding:12px 16px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">Пользователи не найдены</div>`;
    return;
  }

  resultsList.innerHTML = "";
  const q = queryStr.toLowerCase();

  users.forEach((user) => {
    const item = document.createElement("div");
    item.className = "search-result-item";

    // Highlight function: bold & color matched letters in username
    const highlightText = (text, search) => {
      const lower = text.toLowerCase();
      const idx   = lower.indexOf(search.toLowerCase());
      if (idx === -1) return escapeHtml(text);

      const before = escapeHtml(text.slice(0, idx));
      const match  = escapeHtml(text.slice(idx, idx + search.length));
      const after  = escapeHtml(text.slice(idx + search.length));
      return `${before}<span class="highlight">${match}</span>${after}`;
    };

    const displayName = user.displayName || user.username;
    const username    = user.username || user.id;

    item.innerHTML = `
      <div class="search-result-avatar">
        <img src="${getAvatarUrl(username)}" alt="${username}" loading="lazy"
          onerror="this.src='https://minotar.net/helm/MHF_Steve/100.png'" />
      </div>
      <div class="search-result-info">
        <div class="search-result-name">${escapeHtml(displayName)}</div>
        <div class="search-result-tag">@${highlightText(username, q)}</div>
      </div>
    `;

    item.addEventListener("click", () => {
      openChat(username, displayName);
    });

    resultsList.appendChild(item);

    // Animate in
    gsap.fromTo(item, { opacity: 0, x: -10 }, {
      opacity: 1, x: 0, duration: 0.2,
      delay: resultsList.children.length * 0.04,
    });
  });
}

// ═══════════════════
// 2. CHAT LIST
// ═══════════════════
function loadChatList() {
  const chatListEl  = document.getElementById("chat-list");
  const chatsEmpty  = document.getElementById("chats-empty");
  if (!chatListEl) return;

  // Listen to conversations where current user is a member
  const convsRef = collection(firestore, "conversations");
  const q = query(
    convsRef,
    where("members", "array-contains", session.username),
    orderBy("updatedAt", "desc"),
    limit(50)
  );

  chatListListener = onSnapshot(q, async (snap) => {
    chatListEl.innerHTML = "";

    if (snap.empty) {
      chatsEmpty && chatsEmpty.classList.remove("hidden");
      pulseFAB();
      return;
    }
    chatsEmpty && chatsEmpty.classList.add("hidden");

    const promises = snap.docs.map(async (d) => {
      const data = d.data();
      const peer = data.members.find((m) => m !== session.username);
      if (!peer) return null;

      const peerData = await getDoc(doc(firestore, "users", peer)).catch(() => null);
      const peerName = peerData?.data()?.displayName || peer;

      return {
        id:          d.id,
        peer,
        peerName,
        lastMessage: data.lastMessage || "",
        updatedAt:   data.updatedAt,
        unread:      data.unreadCount?.[session.username] || 0,
      };
    });

    const chats = (await Promise.all(promises)).filter(Boolean);

    chats.forEach((chat, i) => {
      const item = buildChatListItem(chat);
      chatListEl.appendChild(item);
      gsap.fromTo(item,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.25, delay: i * 0.04 }
      );
    });
  }, (err) => {
    console.error("[ChatList] Error:", err);
  });
}

function buildChatListItem(chat) {
  const item = document.createElement("div");
  item.className = "chat-item";
  item.dataset.peer = chat.peer;

  const timeStr = chat.updatedAt
    ? formatTime(chat.updatedAt.toDate ? chat.updatedAt.toDate() : new Date(chat.updatedAt))
    : "";

  const badgeHtml = chat.unread > 0
    ? `<div class="chat-item-badge">${chat.unread > 99 ? "99+" : chat.unread}</div>`
    : "";

  item.innerHTML = `
    <div class="chat-item-avatar">
      <img src="${getAvatarUrl(chat.peer)}" alt="${chat.peer}" loading="lazy"
        onerror="this.src='https://minotar.net/helm/MHF_Steve/100.png'" />
    </div>
    <div class="chat-item-body">
      <div class="chat-item-top">
        <div class="chat-item-name">${escapeHtml(chat.peerName)}</div>
        <div class="chat-item-time">${timeStr}</div>
      </div>
      <div class="chat-item-preview">${escapeHtml(truncate(chat.lastMessage, 40))}</div>
    </div>
    ${badgeHtml}
  `;

  item.addEventListener("click", () => openChat(chat.peer, chat.peerName));
  return item;
}

// ═══════════════════
// 3. OPEN CHAT
// ═══════════════════
export async function openChat(peerUsername, peerDisplayName) {
  activePeerUsername   = peerUsername;
  activeConversationId = buildConversationId(session.username, peerUsername);

  // Update chat header UI
  const peerNameEl   = document.getElementById("chat-peer-name");
  const peerAvatarEl = document.getElementById("chat-peer-avatar");
  const peerStatusEl = document.getElementById("chat-peer-status");

  if (peerNameEl)   peerNameEl.textContent = peerDisplayName || peerUsername;
  if (peerAvatarEl) {
    peerAvatarEl.src = getAvatarUrl(peerUsername);
    peerAvatarEl.onerror = () => { peerAvatarEl.src = "https://minotar.net/helm/MHF_Steve/100.png"; };
  }

  // Fetch peer status
  try {
    const peerDoc = await getDoc(doc(firestore, "users", peerUsername));
    if (peerDoc.exists() && peerStatusEl) {
      const data = peerDoc.data();
      if (data.online) {
        peerStatusEl.textContent = "онлайн";
        peerStatusEl.style.color = "var(--accent-2)";
      } else if (data.lastSeen) {
        const d = data.lastSeen.toDate ? data.lastSeen.toDate() : new Date(data.lastSeen);
        peerStatusEl.textContent = `был(а) ${formatRelativeTime(d)}`;
        peerStatusEl.style.color = "";
      }
    }
  } catch (_) {}

  // Ensure conversation doc exists
  const convRef = doc(firestore, "conversations", activeConversationId);
  const convSnap = await getDoc(convRef).catch(() => null);
  if (!convSnap || !convSnap.exists()) {
    await setDoc(convRef, {
      members:    [session.username, peerUsername],
      lastMessage:"",
      updatedAt:  serverTimestamp(),
      unreadCount: { [session.username]: 0, [peerUsername]: 0 },
    });
  }

  // Reset unread for current user
  await updateDoc(convRef, {
    [`unreadCount.${session.username}`]: 0,
  }).catch(() => {});

  // Show chat screen
  showScreen("screen-chat", "right");

  // Clear old messages listener
  if (messagesListener) messagesListener();

  // Reset messages list
  const msgList  = document.getElementById("messages-list");
  const msgEmpty = document.getElementById("messages-empty");
  if (msgList) msgList.innerHTML = "";

  // Subscribe to messages
  const messagesRef = collection(firestore, "conversations", activeConversationId, "messages");
  const msgsQuery   = query(messagesRef, orderBy("createdAt", "asc"), limit(200));

  let firstLoad = true;
  messagesListener = onSnapshot(msgsQuery, (snap) => {
    if (firstLoad) {
      firstLoad = false;
      msgList.innerHTML = "";
      let lastDate = null;

      snap.docs.forEach((d) => {
        const msg = d.data();
        const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
        const dateKey = date.toDateString();

        if (dateKey !== lastDate) {
          lastDate = dateKey;
          const sep = buildDateSeparator(date);
          msgList.appendChild(sep);
        }

        const bubble = buildMessageBubble(d.id, msg);
        msgList.appendChild(bubble);
      });

      scrollToBottom("messages-container", false);

      if (snap.empty && msgEmpty) msgEmpty.style.display = "flex";
      else if (msgEmpty) msgEmpty.style.display = "none";
    } else {
      // Real-time additions
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          if (msgEmpty) msgEmpty.style.display = "none";
          const bubble = buildMessageBubble(change.doc.id, change.doc.data());
          animateBubbleIn(bubble);
          msgList.appendChild(bubble);
          scrollToBottom("messages-container", true);
        }
      });
    }
  }, (err) => {
    console.error("[Messages] Error:", err);
  });
}

function buildMessageBubble(id, msg) {
  const isMine = msg.sender === session.username;
  const el     = document.createElement("div");
  el.className = `message-bubble ${isMine ? "out" : "in"}`;
  el.dataset.id = id;

  const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
  const timeStr = date.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  const statusHtml = isMine
    ? `<span class="message-status">✓✓</span>`
    : "";

  el.innerHTML = `
    <div class="message-text">${escapeHtml(msg.text || "")}</div>
    <div class="message-meta">
      <span class="message-time">${timeStr}</span>
      ${statusHtml}
    </div>
  `;

  return el;
}

function buildDateSeparator(date) {
  const sep = document.createElement("div");
  sep.className = "date-separator";
  sep.textContent = date.toLocaleDateString("ru", { day: "numeric", month: "long" });
  return sep;
}

// ═══════════════════
// 4. SEND MESSAGE
// ═══════════════════
export async function sendMessage(text) {
  if (!text || !text.trim() || !activeConversationId) return;

  const trimmed = text.trim();

  try {
    const msgRef = collection(firestore, "conversations", activeConversationId, "messages");
    await addDoc(msgRef, {
      text:      trimmed,
      sender:    session.username,
      createdAt: serverTimestamp(),
    });

    // Update conversation metadata
    await updateDoc(doc(firestore, "conversations", activeConversationId), {
      lastMessage: trimmed,
      updatedAt:   serverTimestamp(),
      [`unreadCount.${activePeerUsername}`]: (await getDoc(doc(firestore, "conversations", activeConversationId)))
        .data()?.unreadCount?.[activePeerUsername] + 1 || 1,
    });

  } catch (err) {
    console.error("[SendMessage] Error:", err);
    showToast("Не удалось отправить сообщение", "error");
  }
}

// ═══════════════════
// 5. FAB / NEW CHAT
// ═══════════════════
function initFAB() {
  const fab = document.getElementById("fab-new-chat");
  if (!fab) return;

  fab.addEventListener("click", () => {
    // Open new chat search modal
    const searchInput = document.getElementById("chat-search-input");
    if (searchInput) {
      searchInput.focus();
      gsap.fromTo(searchInput,
        { boxShadow: "0 0 0 3px var(--accent-glow)" },
        { boxShadow: "0 0 0 0px transparent", duration: 1.0 }
      );
    }
    pulseFAB();
  });
}

// ═══════════════════
// 6. CHAT VIEW BTNS
// ═══════════════════
function initChatViewButtons() {
  const btnBack    = document.getElementById("btn-back-chat");
  const btnSend    = document.getElementById("btn-send-message");
  const msgInput   = document.getElementById("message-input");
  const btnAttach  = document.getElementById("btn-attach");
  const btnOptions = document.getElementById("btn-chat-options");

  btnBack && btnBack.addEventListener("click", () => {
    if (messagesListener) {
      messagesListener();
      messagesListener = null;
    }
    showScreen("screen-main", "left");
  });

  btnSend && btnSend.addEventListener("click", () => {
    const text = msgInput?.value || "";
    if (!text.trim()) return;
    sendMessage(text);
    if (msgInput) {
      msgInput.value = "";
      msgInput.style.height = "auto";
    }
  });

  msgInput && msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      btnSend && btnSend.click();
    }
  });

  btnAttach && btnAttach.addEventListener("click", () => {
    showModal({
      title:  "Вложения",
      body:   "Прикрепление файлов будет доступно в следующей версии Mystery Chat.",
      actions: [{ label: "Окей", className: "modal-btn--primary" }],
    });
  });

  btnOptions && btnOptions.addEventListener("click", () => {
    showModal({
      title:  `@${activePeerUsername || "?"}`,
      body:   `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">Действия с чатом</div>
        </div>
      `,
      actions: [
        {
          label: "Очистить историю",
          className: "modal-btn--danger",
          onClick: () => showToast("Функция очистки в разработке", "info"),
        },
        { label: "Закрыть", className: "modal-btn--ghost" },
      ],
    });
  });
}

// ════════════════════════════════════════════
// POPULATE PROFILE & SETTINGS UI
// ════════════════════════════════════════════
export function populateProfileUI(userData) {
  const avatarUrl = getAvatarUrl(userData.username);

  // Settings tab
  const settingsAvatar = document.getElementById("settings-avatar");
  if (settingsAvatar) {
    settingsAvatar.innerHTML = `<img src="${avatarUrl}" alt="avatar"
      onerror="this.src='https://minotar.net/helm/MHF_Steve/100.png'" />`;
  }
  const settingsName = document.getElementById("settings-display-name");
  const settingsUsr  = document.getElementById("settings-username");
  if (settingsName) settingsName.textContent = userData.displayName || userData.username;
  if (settingsUsr)  settingsUsr.textContent  = `@${userData.username}`;

  // Profile tab
  const profImg = document.getElementById("profile-avatar-img");
  if (profImg) {
    profImg.src = avatarUrl;
    profImg.onerror = () => { profImg.src = "https://minotar.net/helm/MHF_Steve/100.png"; };
  }
  const profName = document.getElementById("profile-name");
  const profTag  = document.getElementById("profile-tag");
  const profBio  = document.getElementById("profile-bio");
  const statRep  = document.getElementById("stat-rep");

  if (profName) profName.textContent = userData.displayName || userData.username;
  if (profTag)  profTag.textContent  = `@${userData.username}`;
  if (profBio)  profBio.textContent  = userData.bio || "Тайна окутывает всё...";
  if (statRep)  statRep.textContent  = userData.rep || 0;

  // Also load message/chat counts
  loadProfileStats(userData.username);
}

async function loadProfileStats(username) {
  try {
    const convsRef = collection(firestore, "conversations");
    const q = query(convsRef, where("members", "array-contains", username));
    const snap = await getDocs(q);

    const statChats = document.getElementById("stat-chats");
    if (statChats) statChats.textContent = snap.size;

    // Count total messages sent
    let totalMessages = 0;
    const msgPromises = snap.docs.map(async (d) => {
      const msgsRef = collection(firestore, "conversations", d.id, "messages");
      const msgsSnap = await getDocs(query(msgsRef, where("sender", "==", username)));
      totalMessages += msgsSnap.size;
    });
    await Promise.all(msgPromises);

    const statMsgs = document.getElementById("stat-messages");
    if (statMsgs) statMsgs.textContent = totalMessages;

  } catch (_) {}
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

function formatTime(date) {
  const now   = new Date();
  const diff  = now - date;
  const day   = 86400000;
  if (diff < day && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  } else if (diff < 7 * day) {
    return date.toLocaleDateString("ru", { weekday: "short" });
  } else {
    return date.toLocaleDateString("ru", { day: "numeric", month: "short" });
  }
}

function formatRelativeTime(date) {
  const diff    = Date.now() - date;
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (minutes < 1)   return "только что";
  if (minutes < 60)  return `${minutes} мин назад`;
  if (hours   < 24)  return `${hours} ч назад`;
  return `${days} дн назад`;
}

export { activeConversationId, activePeerUsername };

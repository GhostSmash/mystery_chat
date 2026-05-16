// ═══════════════════════════════════════════════════════
// chat.js · Mystery Chat v2
// Real-time chat · File uploads · Reactions · Context menu
// Peer profile · History clear · Existing conversations
// ═══════════════════════════════════════════════════════
import { firestore, storage } from "./firebase-config.js";
import { session } from "./auth.js";
import {
  showToast, showScreen, showModal, animateBubbleIn,
  scrollToBottom, openPeerPanel, closePeerPanel,
} from "./ui-animations.js";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  startAt, endAt, Timestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ── STATE ──
let activeConvId   = null;
let activePeer     = null;   // username
let activePeerName = null;
let msgsListener   = null;
let chatListListener = null;
let ctxMsgId       = null;
let ctxMsgData     = null;
let longPressTimer = null;
let searchTimer    = null;
let deletedForMeIds = new Set(); // locally hidden

export const getAvatarUrl  = u => `https://minotar.net/helm/${u}/100.png`;
export const buildConvId   = (a,b) => [a,b].sort().join("__");

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
export function initChat() {
  initChatList();
  initChatViewButtons();
  initContextMenu();
  initSearchOverlay();
  initFileInput();
}

// ══════════════════════════════════════════
// CHAT LIST (existing conversations)
// ══════════════════════════════════════════
function initChatList() {
  const listEl   = document.getElementById("chat-list");
  const emptyEl  = document.getElementById("chats-empty");
  if (!listEl) return;
  if (chatListListener) chatListListener();

  const q = query(
    collection(firestore,"conversations"),
    where("members","array-contains",session.username),
    orderBy("updatedAt","desc"),
    limit(80)
  );

  chatListListener = onSnapshot(q, async snap => {
    listEl.innerHTML = "";
    if (snap.empty) { emptyEl?.classList.remove("hidden"); return; }
    emptyEl?.classList.add("hidden");

    const items = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      const peer = data.members.find(m => m !== session.username);
      if (!peer) return null;
      let peerName = peer, peerAvatar = null;
      try {
        const pd = await getDoc(doc(firestore,"users",peer));
        if (pd.exists()) {
          const pdata = pd.data();
          peerName   = pdata.displayName || peer;
          peerAvatar = pdata.avatarUrl || null;
        }
      } catch(_) {}
      return { id:d.id, peer, peerName, peerAvatar,
        lastMessage: data.lastMessage || "",
        lastSender:  data.lastSender || "",
        updatedAt:   data.updatedAt,
        unread:      data.unreadCount?.[session.username] || 0,
      };
    }));

    items.filter(Boolean).forEach((chat, i) => {
      const el = buildChatListItem(chat);
      listEl.appendChild(el);
      gsap.fromTo(el, {opacity:0,y:10},{opacity:1,y:0,duration:.22,delay:i*.04});
    });
  }, err => console.error("[ChatList]",err));
}

function buildChatListItem(chat) {
  const el = document.createElement("div");
  el.className = "chat-item";
  el.dataset.peer = chat.peer;
  const timeStr = chat.updatedAt ? fmtTime(chat.updatedAt.toDate?.() ?? new Date()) : "";
  const preview = chat.lastMessage
    ? (chat.lastSender === session.username ? `Вы: ${chat.lastMessage}` : chat.lastMessage)
    : "Нажми чтобы открыть";
  const avatarSrc = chat.peerAvatar || getAvatarUrl(chat.peer);

  el.innerHTML = `
    <div class="chat-item-avatar">
      <img src="${avatarSrc}" alt="${chat.peer}"
        onerror="this.src='${getAvatarUrl(chat.peer)}'" loading="lazy" />
    </div>
    <div class="chat-item-body">
      <div class="chat-item-top">
        <div class="chat-item-name">${esc(chat.peerName)}</div>
        <div class="chat-item-time">${timeStr}</div>
      </div>
      <div class="chat-item-preview ${chat.unread>0?'unread-preview':''}">${esc(trunc(preview,44))}</div>
    </div>
    <div class="chat-item-right">
      ${chat.unread>0 ? `<div class="chat-item-badge">${chat.unread>99?'99+':chat.unread}</div>` : ''}
    </div>`;
  el.addEventListener("click", () => openChat(chat.peer, chat.peerName, chat.peerAvatar));
  return el;
}

// ══════════════════════════════════════════
// OPEN CHAT
// ══════════════════════════════════════════
export async function openChat(peerUsername, peerDisplayName, peerAvatarUrl) {
  activePeer     = peerUsername;
  activePeerName = peerDisplayName || peerUsername;
  activeConvId   = buildConvId(session.username, peerUsername);
  deletedForMeIds.clear();

  const avatarSrc = peerAvatarUrl || getAvatarUrl(peerUsername);

  // Update chat header
  const nameEl   = document.getElementById("chat-peer-name");
  const avatarEl = document.getElementById("chat-peer-avatar");
  const statusEl = document.getElementById("chat-peer-status");
  if (nameEl)   nameEl.textContent  = activePeerName;
  if (avatarEl) { avatarEl.src = avatarSrc; avatarEl.onerror = () => { avatarEl.src = getAvatarUrl(peerUsername); }; }

  // Fetch peer online status
  try {
    const pd = await getDoc(doc(firestore,"users",peerUsername));
    if (pd.exists() && statusEl) {
      const d = pd.data();
      if (d.online) { statusEl.textContent = "в сети"; statusEl.style.color = "var(--accent-2)"; }
      else if (d.lastSeen) {
        const dt = d.lastSeen.toDate?.() ?? new Date(d.lastSeen);
        statusEl.textContent = `был(а) ${fmtRelative(dt)}`; statusEl.style.color = "";
      }
    }
  } catch(_) {}

  // Ensure conversation exists
  const convRef = doc(firestore,"conversations",activeConvId);
  const convSnap = await getDoc(convRef).catch(() => null);
  if (!convSnap?.exists()) {
    await setDoc(convRef, {
      members: [session.username, peerUsername],
      lastMessage: "", lastSender: "",
      updatedAt: serverTimestamp(),
      unreadCount: { [session.username]:0, [peerUsername]:0 },
    });
  }
  // Clear unread for me
  await updateDoc(convRef, { [`unreadCount.${session.username}`]: 0 }).catch(()=>{});

  showScreen("screen-chat", "right");

  // Clear messages, stop old listener
  if (msgsListener) { msgsListener(); msgsListener = null; }
  const msgList = document.getElementById("messages-list");
  const msgEmpty = document.getElementById("messages-empty");
  if (msgList) msgList.innerHTML = "";

  // Load locally deleted IDs
  const localKey = `deleted_me_${activeConvId}_${session.username}`;
  const stored = localStorage.getItem(localKey);
  if (stored) { try { JSON.parse(stored).forEach(id => deletedForMeIds.add(id)); } catch(_){} }

  // Subscribe to messages
  const msgsQuery = query(
    collection(firestore,"conversations",activeConvId,"messages"),
    orderBy("createdAt","asc"), limit(300)
  );

  let firstLoad = true;
  msgsListener = onSnapshot(msgsQuery, snap => {
    if (firstLoad) {
      firstLoad = false;
      msgList.innerHTML = "";
      let lastDate = null;
      snap.docs.forEach(d => {
        const msg = { id:d.id, ...d.data() };
        if (msg.deletedForAll) return; // skip globally deleted
        if (deletedForMeIds.has(d.id)) return; // skip deleted for me
        const dt = msg.createdAt?.toDate?.() ?? new Date();
        const dk = dt.toDateString();
        if (dk !== lastDate) { lastDate = dk; msgList.appendChild(mkDateSep(dt)); }
        const row = buildMsgRow(msg);
        msgList.appendChild(row);
      });
      scrollToBottom("messages-container", false);
      if (snap.empty) { if(msgEmpty) msgEmpty.style.display="flex"; }
      else { if(msgEmpty) msgEmpty.style.display="none"; }
    } else {
      snap.docChanges().forEach(change => {
        const msg = { id:change.doc.id, ...change.doc.data() };
        if (change.type === "added") {
          if (msg.deletedForAll || deletedForMeIds.has(msg.id)) return;
          if (msgEmpty) msgEmpty.style.display = "none";
          const row = buildMsgRow(msg);
          animateBubbleIn(row);
          msgList.appendChild(row);
          scrollToBottom("messages-container", true);
        }
        if (change.type === "modified") {
          const existing = msgList.querySelector(`[data-msgid="${msg.id}"]`);
          if (existing) {
            if (msg.deletedForAll) { existing.closest(".msg-row")?.remove(); return; }
            // Update reactions
            const reactionBar = existing.querySelector(".reaction-bar");
            const newReactions = buildReactionBar(msg.id, msg.reactions || {});
            if (reactionBar) reactionBar.replaceWith(newReactions);
            else existing.after(newReactions);
          }
        }
        if (change.type === "removed") {
          const existing = msgList.querySelector(`[data-msgid="${change.doc.id}"]`);
          existing?.closest(".msg-row")?.remove();
        }
      });
    }
  }, err => console.error("[Messages]",err));
}

// ══════════════════════════════════════════
// BUILD MESSAGE ROW
// ══════════════════════════════════════════
function buildMsgRow(msg) {
  const isMine = msg.sender === session.username;
  const row = document.createElement("div");
  row.className = `msg-row ${isMine ? "out" : "in"}`;
  row.dataset.msgid = msg.id;

  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${isMine ? "out" : "in"}`;
  bubble.dataset.msgid = msg.id;

  const dt = msg.createdAt?.toDate?.() ?? new Date();
  const timeStr = dt.toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"});

  // Content: media / file / text
  let contentHtml = "";
  if (msg.type === "image") {
    contentHtml = `<div class="msg-media"><img src="${esc(msg.url)}" alt="photo" loading="lazy" onclick="window.openMedia('${esc(msg.url)}','image')" /></div>`;
  } else if (msg.type === "video") {
    contentHtml = `<div class="msg-media"><video src="${esc(msg.url)}" controls playsinline></video></div>`;
  } else if (msg.type === "file") {
    contentHtml = `<div class="msg-file-card" onclick="window.open('${esc(msg.url)}','_blank')">
      <div class="msg-file-icon">${fileIcon(msg.fileName || "")}</div>
      <div class="msg-file-info">
        <div class="msg-file-name">${esc(msg.fileName || "Файл")}</div>
        <div class="msg-file-size">${fmtBytes(msg.fileSize || 0)}</div>
      </div></div>`;
  } else {
    contentHtml = `<div class="message-text">${esc(msg.text || "")}</div>`;
  }

  if (msg.deletedForAll) {
    contentHtml = `<div class="message-text" style="color:var(--text-muted);font-style:italic;">Сообщение удалено</div>`;
  }

  const statusHtml = isMine ? `<span class="message-status">✓✓</span>` : "";

  bubble.innerHTML = `
    ${contentHtml}
    <div class="message-meta">
      <span class="message-time">${timeStr}</span>
      ${msg.edited ? '<span class="message-edited">ред.</span>' : ""}
      ${statusHtml}
    </div>`;

  row.appendChild(bubble);

  // Reaction bar
  const rbar = buildReactionBar(msg.id, msg.reactions || {});
  row.appendChild(rbar);

  // Long press / double-click for context menu
  setupMsgInteractions(bubble, msg, row);

  return row;
}

function buildReactionBar(msgId, reactions) {
  const bar = document.createElement("div");
  bar.className = "reaction-bar";
  bar.dataset.msgid = msgId;
  const counts = {};
  Object.entries(reactions || {}).forEach(([user, emoji]) => {
    counts[emoji] = (counts[emoji] || []);
    counts[emoji].push(user);
  });
  Object.entries(counts).forEach(([emoji, users]) => {
    const pill = document.createElement("div");
    pill.className = `reaction-pill${users.includes(session.username)?" mine":""}`;
    pill.innerHTML = `${emoji}<span class="reaction-count">${users.length}</span>`;
    pill.title = users.join(", ");
    pill.addEventListener("click", () => toggleReaction(msgId, emoji));
    bar.appendChild(pill);
  });
  return bar;
}

function setupMsgInteractions(bubble, msg, row) {
  // Long press → context menu
  bubble.addEventListener("pointerdown", e => {
    longPressTimer = setTimeout(() => {
      showCtxMenu(e.clientX, e.clientY, msg.id, msg);
    }, 500);
  });
  bubble.addEventListener("pointerup",   () => clearTimeout(longPressTimer));
  bubble.addEventListener("pointerleave",() => clearTimeout(longPressTimer));
  bubble.addEventListener("contextmenu", e => {
    e.preventDefault(); showCtxMenu(e.clientX, e.clientY, msg.id, msg);
  });

  // Double click → heart
  bubble.addEventListener("dblclick", () => toggleReaction(msg.id, "❤️"));
}

// ══════════════════════════════════════════
// REACTIONS
// ══════════════════════════════════════════
async function toggleReaction(msgId, emoji) {
  if (!activeConvId || !msgId) return;
  const msgRef = doc(firestore,"conversations",activeConvId,"messages",msgId);
  try {
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const reactions = snap.data().reactions || {};
    const cur = reactions[session.username];
    const update = {};
    if (cur === emoji) {
      // Remove reaction
      update[`reactions.${session.username}`] = null;
      await updateDoc(msgRef, { [`reactions.${session.username}`]: null });
      // Actually delete the field
      const batch = writeBatch(firestore);
      const data = snap.data();
      delete data.reactions[session.username];
      batch.update(msgRef, { reactions: data.reactions });
      await batch.commit();
    } else {
      await updateDoc(msgRef, { [`reactions.${session.username}`]: emoji });
    }
  } catch(e) { console.error("[Reaction]",e); }
}

// ══════════════════════════════════════════
// CONTEXT MENU
// ══════════════════════════════════════════
function initContextMenu() {
  const menu = document.getElementById("msg-ctx-menu");
  if (!menu) return;

  // Emoji reactions
  menu.querySelectorAll(".ctx-emoji").forEach(btn => {
    btn.addEventListener("click", () => {
      if (ctxMsgId) toggleReaction(ctxMsgId, btn.dataset.emoji);
      hideCtxMenu();
    });
  });

  // Copy
  document.getElementById("ctx-copy")?.addEventListener("click", () => {
    if (ctxMsgData?.text) navigator.clipboard.writeText(ctxMsgData.text).then(() => showToast("Скопировано","success"));
    hideCtxMenu();
  });

  // Delete for me
  document.getElementById("ctx-del-me")?.addEventListener("click", () => {
    deleteForMe(ctxMsgId); hideCtxMenu();
  });

  // Delete for all
  document.getElementById("ctx-del-all")?.addEventListener("click", () => {
    if (ctxMsgData?.sender !== session.username) {
      showToast("Только своё сообщение можно удалить у всех", "error"); hideCtxMenu(); return;
    }
    deleteForAll(ctxMsgId); hideCtxMenu();
  });

  // Close on outside click
  document.addEventListener("click", e => {
    if (!menu.contains(e.target)) hideCtxMenu();
  }, true);
}

function showCtxMenu(x, y, msgId, msgData) {
  ctxMsgId   = msgId;
  ctxMsgData = msgData;
  const menu  = document.getElementById("msg-ctx-menu");
  if (!menu) return;
  menu.classList.remove("hidden");

  // Position
  const mw = 190, mh = 180;
  const fx = Math.min(x, window.innerWidth  - mw - 8);
  const fy = Math.min(y, window.innerHeight - mh - 8);
  menu.style.left = `${Math.max(8, fx)}px`;
  menu.style.top  = `${Math.max(8, fy)}px`;

  // Highlight existing reaction
  const existingEmoji = msgData.reactions?.[session.username];
  menu.querySelectorAll(".ctx-emoji").forEach(btn => {
    btn.classList.toggle("active-reaction", btn.dataset.emoji === existingEmoji);
  });

  // Show/hide "delete for all" based on ownership
  const delAll = document.getElementById("ctx-del-all");
  if (delAll) delAll.style.display = msgData.sender === session.username ? "" : "none";

  gsap.fromTo(menu, {opacity:0,scale:.88,y:-10},{duration:.18,opacity:1,scale:1,y:0,ease:"back.out(1.5)"});
}

function hideCtxMenu() {
  const menu = document.getElementById("msg-ctx-menu");
  if (!menu || menu.classList.contains("hidden")) return;
  gsap.to(menu, {duration:.14,opacity:0,scale:.9,onComplete:()=>menu.classList.add("hidden")});
  ctxMsgId = null; ctxMsgData = null;
}

// ── Delete for me (locally only) ──
function deleteForMe(msgId) {
  if (!msgId || !activeConvId) return;
  deletedForMeIds.add(msgId);
  const localKey = `deleted_me_${activeConvId}_${session.username}`;
  localStorage.setItem(localKey, JSON.stringify([...deletedForMeIds]));
  const row = document.querySelector(`.msg-row [data-msgid="${msgId}"]`)?.closest(".msg-row");
  if (row) gsap.to(row, {duration:.22,opacity:0,height:0,marginBottom:0,onComplete:()=>row.remove()});
  showToast("Удалено у себя","success");
}

// ── Delete for all (Firestore) ──
async function deleteForAll(msgId) {
  if (!msgId || !activeConvId) return;
  try {
    await updateDoc(doc(firestore,"conversations",activeConvId,"messages",msgId), {
      deletedForAll: true, text: "", url: "", type: "text",
    });
    showToast("Удалено у всех","success");
  } catch(e) { console.error(e); showToast("Ошибка удаления","error"); }
}

// ── Clear history ──
export async function clearHistory(forBoth = false) {
  if (!activeConvId) return;
  try {
    if (forBoth) {
      const msgsSnap = await getDocs(collection(firestore,"conversations",activeConvId,"messages"));
      const batch = writeBatch(firestore);
      msgsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.update(doc(firestore,"conversations",activeConvId), { lastMessage:"", lastSender:"" });
      await batch.commit();
      document.getElementById("messages-list").innerHTML = "";
      document.getElementById("messages-empty").style.display = "flex";
      showToast("История очищена у обоих","success");
    } else {
      // Locally mark all current messages as deleted for me
      const msgsSnap = await getDocs(
        query(collection(firestore,"conversations",activeConvId,"messages"),orderBy("createdAt"),limit(500))
      );
      msgsSnap.docs.forEach(d => deletedForMeIds.add(d.id));
      const localKey = `deleted_me_${activeConvId}_${session.username}`;
      localStorage.setItem(localKey, JSON.stringify([...deletedForMeIds]));
      document.getElementById("messages-list").innerHTML = "";
      document.getElementById("messages-empty").style.display = "flex";
      showToast("История очищена у тебя","success");
    }
  } catch(e) { console.error(e); showToast("Ошибка очистки","error"); }
}

// ══════════════════════════════════════════
// SEND MESSAGE
// ══════════════════════════════════════════
export async function sendMessage(text) {
  if (!text?.trim() || !activeConvId) return;
  const trimmed = text.trim();
  try {
    await addDoc(collection(firestore,"conversations",activeConvId,"messages"),{
      text: trimmed, sender: session.username,
      type: "text", createdAt: serverTimestamp(), reactions: {},
    });
    await updateDoc(doc(firestore,"conversations",activeConvId),{
      lastMessage: trimmed, lastSender: session.username,
      updatedAt: serverTimestamp(),
      [`unreadCount.${activePeer}`]: (await getUnread(activePeer)) + 1,
    });
  } catch(e) { console.error(e); showToast("Не удалось отправить","error"); }
}

async function getUnread(peer) {
  try {
    const s = await getDoc(doc(firestore,"conversations",activeConvId));
    return s.data()?.unreadCount?.[peer] || 0;
  } catch(_) { return 0; }
}

// ══════════════════════════════════════════
// FILE UPLOAD
// ══════════════════════════════════════════
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function uploadAndSendFile(file) {
  if (!file || !activeConvId) return;
  if (file.size > MAX_FILE_SIZE) {
    showToast(`Максимальный размер файла: 25 МБ`, "error"); return;
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const msgType = isImage ? "image" : isVideo ? "video" : "file";

  // Add placeholder bubble with progress bar
  const placeholderId = "upload_" + Date.now();
  const placeholder = addUploadPlaceholder(placeholderId, file.name, msgType);

  try {
    const storePath = `chats/${activeConvId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on("state_changed",
      snap => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        const bar = document.getElementById(placeholderId + "_bar");
        if (bar) bar.style.width = pct + "%";
      },
      err => {
        console.error("[Upload]", err);
        placeholder?.remove();
        showToast("Ошибка загрузки файла", "error");
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        placeholder?.remove();
        // Store message in Firestore
        const msgData = {
          type: msgType, url, sender: session.username,
          createdAt: serverTimestamp(), reactions: {},
          fileName: file.name, fileSize: file.size, storagePath: storePath,
        };
        await addDoc(collection(firestore,"conversations",activeConvId,"messages"), msgData);
        const preview = isImage ? "📷 Фото" : isVideo ? "🎥 Видео" : `📎 ${file.name}`;
        await updateDoc(doc(firestore,"conversations",activeConvId),{
          lastMessage: preview, lastSender: session.username,
          updatedAt: serverTimestamp(),
          [`unreadCount.${activePeer}`]: (await getUnread(activePeer)) + 1,
        });
      }
    );
  } catch(e) {
    console.error("[Upload]",e); placeholder?.remove();
    showToast("Ошибка при загрузке","error");
  }
}

function addUploadPlaceholder(id, name, type) {
  const msgList = document.getElementById("messages-list");
  if (!msgList) return null;
  const row = document.createElement("div");
  row.className = "msg-row out";
  row.id = id;
  const icon = type === "image" ? "📷" : type === "video" ? "🎥" : "📎";
  row.innerHTML = `
    <div class="message-bubble out" style="min-width:140px;">
      <div class="msg-file-card">
        <div class="msg-file-icon">${icon}</div>
        <div class="msg-file-info">
          <div class="msg-file-name">${esc(trunc(name,24))}</div>
          <div class="msg-file-size">Загрузка...</div>
        </div>
      </div>
      <div class="upload-progress"><div class="upload-progress-bar" id="${id}_bar" style="width:0%"></div></div>
    </div>`;
  msgList.appendChild(row);
  scrollToBottom("messages-container", true);
  return row;
}

function initFileInput() {
  const fileInput = document.getElementById("file-input");
  if (!fileInput) return;
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.[0]) uploadAndSendFile(fileInput.files[0]);
    fileInput.value = "";
  });
}

// ══════════════════════════════════════════
// CHAT VIEW BUTTONS
// ══════════════════════════════════════════
function initChatViewButtons() {
  const $ = id => document.getElementById(id);

  // Back
  $("btn-back-chat")?.addEventListener("click", () => {
    if (msgsListener) { msgsListener(); msgsListener = null; }
    showScreen("screen-main","left");
  });

  // Send
  $("btn-send-message")?.addEventListener("click", () => {
    const ta = $("message-input");
    const text = ta?.value || "";
    if (!text.trim()) return;
    sendMessage(text);
    ta.value = ""; ta.style.height = "auto";
  });

  $("message-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("btn-send-message")?.click(); }
  });

  // Attach menu toggle
  const attachBtn  = $("btn-attach");
  const attachMenu = $("attach-menu");
  attachBtn?.addEventListener("click", e => {
    e.stopPropagation();
    attachMenu?.classList.toggle("hidden");
  });
  document.addEventListener("click", () => attachMenu?.classList.add("hidden"), true);

  $("attach-photo")?.addEventListener("click", () => {
    const fi = $("file-input");
    fi.accept = "image/*,video/*"; fi.click();
    attachMenu?.classList.add("hidden");
  });
  $("attach-file")?.addEventListener("click", () => {
    const fi = $("file-input");
    fi.accept = "*/*"; fi.click();
    attachMenu?.classList.add("hidden");
  });

  // Click peer avatar/name → peer profile
  $("chat-header-info")?.addEventListener("click", () => openPeerProfilePanel(activePeer));

  // Chat options (3 dots)
  $("btn-chat-options")?.addEventListener("click", () => {
    showModal({
      title: `Чат с @${activePeer}`,
      body: ``,
      actions: [
        { label:"Очистить у меня", className:"modal-btn--ghost",
          onClick: () => showModal({ title:"Очистить историю",
            body:"Удалить все сообщения только у тебя?",
            actions:[
              {label:"Удалить у меня",className:"modal-btn--danger",onClick:()=>clearHistory(false)},
              {label:"Отмена",className:"modal-btn--ghost"},
            ]}) },
        { label:"Очистить у всех", className:"modal-btn--danger",
          onClick: () => showModal({ title:"Очистить у обоих",
            body:"Сообщения удалятся для обоих участников. Продолжить?",
            actions:[
              {label:"Удалить у всех",className:"modal-btn--danger",onClick:()=>clearHistory(true)},
              {label:"Отмена",className:"modal-btn--ghost"},
            ]}) },
        { label:"Закрыть", className:"modal-btn--ghost" },
      ],
    });
  });

  // Close peer panel
  $("btn-close-peer-panel")?.addEventListener("click", closePeerPanel);
}

// ══════════════════════════════════════════
// PEER PROFILE PANEL
// ══════════════════════════════════════════
export async function openPeerProfilePanel(username) {
  if (!username) return;
  const $ = id => document.getElementById(id);
  openPeerPanel();

  // Load data
  try {
    const snap = await getDoc(doc(firestore,"users",username));
    const data = snap.exists() ? snap.data() : {};
    const avatarSrc = data.avatarUrl || getAvatarUrl(username);

    const imgEl = $("pp-avatar");
    if (imgEl) { imgEl.src = avatarSrc; imgEl.onerror = () => { imgEl.src = getAvatarUrl(username); }; }

    if ($("pp-name")) $("pp-name").textContent = data.displayName || username;
    if ($("pp-tag"))  $("pp-tag").textContent  = `@${username}`;

    const statusEl = $("pp-status");
    if (statusEl) {
      if (data.online) { statusEl.innerHTML = `<span class="status-dot"></span><span>В сети</span>`; }
      else if (data.lastSeen) {
        const dt = data.lastSeen.toDate?.() ?? new Date();
        statusEl.innerHTML = `<span style="color:var(--text-muted)">был(а) ${fmtRelative(dt)}</span>`;
      }
    }

    if ($("pp-bio")) $("pp-bio").textContent = data.bio || "Нет информации о себе";

    // Joined date
    if ($("pp-stat-joined") && data.createdAt) {
      const dt = data.createdAt.toDate?.() ?? new Date();
      $("pp-stat-joined").textContent = dt.toLocaleDateString("ru",{day:"numeric",month:"short",year:"numeric"});
    }

    // Reputation display — > 0 green, < 0 red, 0 hidden
    const rep = data.rep || 0;
    const repEl = $("pp-rep-count");
    if (repEl) {
      if (rep > 0) { repEl.textContent = `+${rep}`; repEl.className = "pp-rep-count positive"; }
      else if (rep < 0) { repEl.textContent = `${rep}`; repEl.className = "pp-rep-count negative"; }
      else { repEl.textContent = ""; repEl.className = "pp-rep-count"; }
    }

    // Count stats async
    loadPeerStats(username);

    // Message button
    const btnMsg = $("btn-pp-message");
    if (btnMsg) {
      btnMsg.onclick = () => {
        closePeerPanel();
        openChat(username, data.displayName || username, data.avatarUrl || null);
      };
    }

    // Rep buttons
    setupRepButtons(username, rep);

    // Load shared media
    loadPeerMedia(username);

  } catch(e) { console.error("[PeerPanel]",e); }
}

async function loadPeerStats(username) {
  try {
    const q = query(collection(firestore,"conversations"), where("members","array-contains",username));
    const snap = await getDocs(q);
    document.getElementById("pp-stat-chats").textContent = snap.size;

    let total = 0;
    await Promise.all(snap.docs.map(async d => {
      const ms = await getDocs(query(collection(firestore,"conversations",d.id,"messages"),where("sender","==",username)));
      total += ms.size;
    }));
    document.getElementById("pp-stat-msg").textContent = total;
  } catch(_) {}
}

async function loadPeerMedia(username) {
  const grid = document.getElementById("pp-media-grid");
  if (!grid) return;
  grid.innerHTML = "";
  try {
    const q = query(
      collection(firestore,"conversations"),
      where("members","array-contains",username)
    );
    const convSnap = await getDocs(q);
    let media = [];
    await Promise.all(convSnap.docs.map(async d => {
      const ms = await getDocs(query(
        collection(firestore,"conversations",d.id,"messages"),
        where("sender","==",username), orderBy("createdAt","desc"), limit(20)
      ));
      ms.docs.forEach(md => {
        const m = md.data();
        if ((m.type==="image"||m.type==="video") && m.url) media.push(m);
      });
    }));
    media = media.slice(0,12);
    if (media.length === 0) {
      grid.innerHTML = `<div class="pp-media-empty" style="grid-column:1/-1">Нет медиа</div>`;
      return;
    }
    media.forEach(m => {
      const el = document.createElement("div");
      el.className = "pp-media-thumb";
      if (m.type==="image") el.innerHTML = `<img src="${esc(m.url)}" loading="lazy" />`;
      else el.innerHTML = `<video src="${esc(m.url)}" muted></video>`;
      el.addEventListener("click", () => window.openMedia(m.url, m.type));
      grid.appendChild(el);
    });
  } catch(e) { console.error(e); grid.innerHTML = `<div class="pp-media-empty" style="grid-column:1/-1">Ошибка загрузки</div>`; }
}

function setupRepButtons(username, currentRep) {
  const plusBtn  = document.getElementById("pp-rep-plus");
  const minusBtn = document.getElementById("pp-rep-minus");
  const repEl    = document.getElementById("pp-rep-count");
  const repKey   = `repvote_${session.username}_${username}`;

  const updateRepDisplay = (rep) => {
    if (!repEl) return;
    if (rep > 0) { repEl.textContent = `+${rep}`; repEl.className = "pp-rep-count positive"; }
    else if (rep < 0) { repEl.textContent = `${rep}`; repEl.className = "pp-rep-count negative"; }
    else { repEl.textContent = ""; repEl.className = "pp-rep-count"; }
  };

  plusBtn?.addEventListener("click", async () => {
    const lastVote = localStorage.getItem(repKey);
    const lastTime = parseInt(localStorage.getItem(repKey + "_time") || "0");
    const cooldown = 24 * 60 * 60 * 1000;
    if (Date.now() - lastTime < cooldown) {
      showToast("Голосовать можно раз в 24 часа", "error"); return;
    }
    try {
      const snap = await getDoc(doc(firestore,"users",username));
      const rep  = (snap.data()?.rep || 0) + 1;
      await updateDoc(doc(firestore,"users",username), { rep });
      localStorage.setItem(repKey, "+1");
      localStorage.setItem(repKey + "_time", Date.now().toString());
      updateRepDisplay(rep);
      showToast(`Репутация @${username} +1 ✓`, "success");
      gsap.fromTo(plusBtn, {scale:1},{scale:1.2,duration:.15,yoyo:true,repeat:1});
    } catch(e) { console.error(e); showToast("Ошибка","error"); }
  });

  minusBtn?.addEventListener("click", async () => {
    const lastTime = parseInt(localStorage.getItem(repKey + "_time") || "0");
    const cooldown = 24 * 60 * 60 * 1000;
    if (Date.now() - lastTime < cooldown) {
      showToast("Голосовать можно раз в 24 часа", "error"); return;
    }
    try {
      const snap = await getDoc(doc(firestore,"users",username));
      const rep  = (snap.data()?.rep || 0) - 1;
      await updateDoc(doc(firestore,"users",username), { rep });
      localStorage.setItem(repKey, "-1");
      localStorage.setItem(repKey + "_time", Date.now().toString());
      updateRepDisplay(rep);
      showToast(`Репутация @${username} -1`, "info");
      gsap.fromTo(minusBtn, {scale:1},{scale:1.2,duration:.15,yoyo:true,repeat:1});
    } catch(e) { console.error(e); showToast("Ошибка","error"); }
  });
}

// ══════════════════════════════════════════
// SEARCH OVERLAY
// ══════════════════════════════════════════
function initSearchOverlay() {
  const input  = document.getElementById("search-overlay-input");
  const clearB = document.getElementById("btn-clear-overlay-search");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearB?.classList.toggle("hidden", !q);
    clearTimeout(searchTimer);
    if (!q) { resetSearchOverlay(); return; }
    searchTimer = setTimeout(() => searchUsers(q), 240);
  });

  clearB?.addEventListener("click", () => {
    input.value = ""; clearB.classList.add("hidden");
    resetSearchOverlay(); input.focus();
  });
}

function resetSearchOverlay() {
  const res = document.getElementById("search-overlay-results");
  if (res) res.innerHTML = `<div class="search-overlay-hint">
    <i data-lucide="users" width="32" height="32"></i>
    <p>Начни вводить имя пользователя</p></div>`;
  if (window.lucide) lucide.createIcons();
}

async function searchUsers(queryStr) {
  const res = document.getElementById("search-overlay-results");
  if (!res) return;
  res.innerHTML = `<div class="search-overlay-hint"><p style="color:var(--text-muted)">Поиск...</p></div>`;

  const qLow = queryStr.toLowerCase();
  try {
    // Prefix search on username
    const snap1 = await getDocs(query(
      collection(firestore,"users"),
      orderBy("username"), startAt(qLow), endAt(qLow+"\uf8ff"), limit(30)
    ));
    // Broad search for displayName match
    const snap2 = await getDocs(query(collection(firestore,"users"), limit(200)));

    const usersMap = new Map();
    snap1.docs.forEach(d => { if(d.id !== session.username) usersMap.set(d.id, d.data()); });
    snap2.docs.forEach(d => {
      if (d.id === session.username) return;
      const dn = (d.data().displayName||"").toLowerCase();
      if (dn.includes(qLow) && !usersMap.has(d.id)) usersMap.set(d.id, d.data());
    });

    const users = [...usersMap.entries()].map(([id,data]) => ({id,...data}));
    renderSearchResults(users, queryStr);
  } catch(e) {
    console.error(e);
    res.innerHTML = `<div class="search-overlay-hint"><p style="color:var(--text-danger)">Ошибка поиска</p></div>`;
  }
}

function renderSearchResults(users, query) {
  const res = document.getElementById("search-overlay-results");
  if (!res) return;
  res.innerHTML = "";

  if (users.length === 0) {
    res.innerHTML = `<div class="search-overlay-hint"><i data-lucide="search-x" width="32" height="32"></i><p>Не найдено</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const label = document.createElement("div");
  label.className = "search-section-label";
  label.textContent = `Пользователи (${users.length})`;
  res.appendChild(label);

  users.forEach((user, i) => {
    const item = document.createElement("div");
    item.className = "search-result-item";
    const avatarSrc = user.avatarUrl || getAvatarUrl(user.username || user.id);
    const username  = user.username || user.id;
    const dname     = user.displayName || username;

    item.innerHTML = `
      <div class="search-result-avatar">
        <img src="${avatarSrc}" loading="lazy" onerror="this.src='${getAvatarUrl(username)}'" />
      </div>
      <div class="search-result-info">
        <div class="search-result-name">${esc(dname)}</div>
        <div class="search-result-tag">@${highlightMatch(username, query)}</div>
      </div>`;

    item.addEventListener("click", () => {
      import("./ui-animations.js").then(({closeSearchOverlay}) => closeSearchOverlay());
      openChat(username, dname, user.avatarUrl || null);
    });

    res.appendChild(item);
    gsap.fromTo(item, {opacity:0,x:-8},{opacity:1,x:0,duration:.18,delay:i*.03});
  });
}

// ══════════════════════════════════════════
// POPULATE PROFILE UI
// ══════════════════════════════════════════
export function populateProfileUI(userData) {
  const avatarSrc = userData.avatarUrl || getAvatarUrl(userData.username);

  // Settings
  const sa = document.getElementById("settings-avatar");
  if (sa) sa.innerHTML = `<img src="${avatarSrc}" onerror="this.src='${getAvatarUrl(userData.username)}'" />`;
  setText("settings-display-name", userData.displayName || userData.username);
  setText("settings-username", `@${userData.username}`);

  // Profile tab
  const pi = document.getElementById("profile-avatar-img");
  if (pi) { pi.src = avatarSrc; pi.onerror = () => { pi.src = getAvatarUrl(userData.username); }; }
  setText("profile-name", userData.displayName || userData.username);
  setText("profile-tag",  `@${userData.username}`);
  setText("profile-bio",  userData.bio || "Тайна окутывает всё...");

  // Reputation display
  const repEl = document.getElementById("stat-rep");
  if (repEl) {
    const rep = userData.rep || 0;
    if (rep > 0) { repEl.textContent = `+${rep}`; repEl.className = "stat-value positive"; }
    else if (rep < 0) { repEl.textContent = `${rep}`; repEl.className = "stat-value negative"; }
    else { repEl.textContent = "—"; repEl.className = "stat-value"; }
  }

  loadMyStats(userData.username);
}

async function loadMyStats(username) {
  try {
    const q = query(collection(firestore,"conversations"),where("members","array-contains",username));
    const snap = await getDocs(q);
    setText("stat-chats", snap.size);
    let total = 0;
    await Promise.all(snap.docs.map(async d => {
      const ms = await getDocs(query(collection(firestore,"conversations",d.id,"messages"),where("sender","==",username)));
      total += ms.size;
    }));
    setText("stat-messages", total);
  } catch(_) {}
}

// ══════════════════════════════════════════
// MEDIA VIEWER (global)
// ══════════════════════════════════════════
window.openMedia = function(url, type = "image") {
  showModal({
    title: type === "image" ? "📷 Фото" : "🎥 Видео",
    body: type === "image"
      ? `<img src="${url}" style="width:100%;border-radius:8px;max-height:70vh;object-fit:contain;" />`
      : `<video src="${url}" controls autoplay style="width:100%;border-radius:8px;max-height:70vh;"></video>`,
    actions: [
      { label:"Открыть в новой вкладке", className:"modal-btn--primary", onClick:()=>window.open(url,"_blank") },
      { label:"Закрыть", className:"modal-btn--ghost" },
    ],
  });
};

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function trunc(s,n){ return s.length>n?s.slice(0,n)+"…":s; }
function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function highlightMatch(text, search) {
  const li = text.toLowerCase().indexOf(search.toLowerCase());
  if (li===-1) return esc(text);
  return esc(text.slice(0,li))+`<span class="highlight">${esc(text.slice(li,li+search.length))}</span>`+esc(text.slice(li+search.length));
}
function fmtTime(d) {
  const now=new Date(), diff=now-d;
  if(diff<86400000&&d.getDate()===now.getDate()) return d.toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"});
  if(diff<7*86400000) return d.toLocaleDateString("ru",{weekday:"short"});
  return d.toLocaleDateString("ru",{day:"numeric",month:"short"});
}
function fmtRelative(d) {
  const m=Math.floor((Date.now()-d)/60000),h=Math.floor(m/60),days=Math.floor(h/24);
  if(m<1)return "только что"; if(m<60)return `${m} мин назад`;
  if(h<24)return `${h} ч назад`; return `${days} дн назад`;
}
function fmtBytes(b) {
  if(b<1024)return `${b} B`; if(b<1048576)return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function fileIcon(name) {
  const ext=(name.split(".").pop()||"").toLowerCase();
  if(["jpg","jpeg","png","gif","webp"].includes(ext))return "🖼";
  if(["mp4","mov","webm","avi"].includes(ext))return "🎥";
  if(["mp3","ogg","wav","m4a"].includes(ext))return "🎵";
  if(["pdf"].includes(ext))return "📄";
  if(["zip","rar","7z"].includes(ext))return "📦";
  if(["doc","docx"].includes(ext))return "📝";
  return "📎";
}
function mkDateSep(date) {
  const el=document.createElement("div"); el.className="date-separator";
  el.textContent=date.toLocaleDateString("ru",{day:"numeric",month:"long"}); return el;
}

export { activePeer, activePeerName, activeConvId };

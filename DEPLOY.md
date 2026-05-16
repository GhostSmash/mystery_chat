# Mystery Chat v2.0 · Deploy Guide
# Made by Smashh

## ══ Firestore Rules ══
# Вставить в Firebase Console → Firestore → Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{username} {
      allow read:   if true;
      allow create: if request.resource.data.username == username;
      allow update: if true;
      allow delete: if false;
    }

    match /conversations/{convId} {
      allow read, write: if true;
      match /messages/{msgId} {
        allow read, write: if true;
      }
    }
  }
}
```

## ══ Firebase Storage Rules ══
# Firebase Console → Storage → Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{allPaths=**} {
      allow read:  if true;
      allow write: if request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /chats/{convId}/{allPaths=**} {
      allow read:  if true;
      allow write: if request.resource.size < 25 * 1024 * 1024;
    }
  }
}
```

## ══ Firestore Indexes ══
# Firebase Console → Firestore → Indexes → Create composite index

1. Collection: conversations
   Fields: members (Arrays) + updatedAt (Descending)
   Query scope: Collection

2. Collection: users  
   Fields: username (Ascending)
   Query scope: Collection

## ══ File Structure ══
```
mystery-chat/
├── index.html          ← SPA entry point
├── styles.css          ← All CSS (5 themes, glassmorphism, reactions)
├── firebase-config.js  ← Firebase v10 init
├── three-bg.js         ← Three.js particles + GLSL glitch shader
├── ui-animations.js    ← GSAP transitions, toasts, modals, themes
├── auth.js             ← Username/password auth + change password
├── chat.js             ← Realtime chat, file uploads, reactions, search
├── games.js            ← 4 playable games (Snake/Tetris/2048/Pong) + stock avatars
├── bot-utils.js        ← Telegram Bot API placeholder
└── app.js              ← Main orchestrator
```

## ══ GitHub Pages Hosting ══
Your setup (GitHub → main branch → root) already works.
Just push all files to the repo root.

## ══ New Features v2 ══
- ✅ Chat list shows existing conversations
- ✅ Click peer avatar/name → full profile panel
- ✅ Reputation system (+/-) with 24h cooldown
- ✅ Rep display: green if positive, red if negative
- ✅ Message context menu (long press 500ms / right click)
- ✅ Reactions: ❤️ 👍 👎 🙂 🔥
- ✅ Double-click message → heart reaction
- ✅ Delete for me (local) / Delete for all (Firestore)
- ✅ Clear history: for me only OR for both
- ✅ File/image/video attachments (up to 25 MB)
- ✅ Firebase Storage for files and avatars (up to 5 MB)
- ✅ 10 stock avatars (Minecraft pixel art)
- ✅ Custom avatar upload with size validation
- ✅ Real password change (old + new + confirm)
- ✅ 5 themes: Dark, Light, Neon, Ocean, Sunset
- ✅ Search opens as full overlay (not inside chat list)
- ✅ 4 fully playable games via blob URLs (no iframe CSP issues)
- ✅ Shared media gallery in peer profile panel

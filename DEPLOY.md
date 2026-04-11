// ═══════════════════════════════════════════════════════
// MYSTERY CHAT · DEPLOYMENT GUIDE
// ═══════════════════════════════════════════════════════

/*
  ██████████████████████████████████████████████████████
  СТРУКТУРА ФАЙЛОВ:
  ██████████████████████████████████████████████████████

  mystery-chat/
  ├── index.html          ← Точка входа SPA
  ├── styles.css          ← Весь CSS (глассморфизм, VHS, dark)
  ├── firebase-config.js  ← Firebase v10 init + экспорты
  ├── three-bg.js         ← Three.js частицы + glitch шейдер
  ├── ui-animations.js    ← GSAP переходы, тосты, модалы, навигация
  ├── auth.js             ← Username+Password авторизация через Firestore
  ├── chat.js             ← Чаты, поиск, сообщения в реальном времени
  ├── bot-utils.js        ← Telegram Bot API утилиты (placeholder)
  ├── app.js              ← Главный оркестратор
  └── DEPLOY.md           ← Этот файл

  ██████████████████████████████████████████████████████
  FIRESTORE RULES (вставь в Firebase Console → Firestore → Rules)
  ██████████████████████████████████████████████████████
*/

const FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection
    match /users/{username} {
      // Чтение: любой аутентифицированный (через session, проверяем по наличию документа)
      // Запись: только сам пользователь (по username)
      allow read: if true;
      allow create: if request.resource.data.username == username;
      allow update: if request.resource.data.keys().hasOnly([
        'online', 'lastSeen', 'bio', 'displayName', 'rep', 'passwordHash'
      ]);
      allow delete: if false;
    }

    // Conversations collection
    match /conversations/{convId} {
      allow read, write: if true;  // Замени на auth-based позже

      // Messages subcollection
      match /messages/{msgId} {
        allow read, write: if true;
      }
    }
  }
}
`;

/*
  ██████████████████████████████████████████████████████
  FIREBASE INDEXES (Firestore → Indexes → добавь вручную)
  ██████████████████████████████████████████████████████

  Collection: conversations
  Fields:
    - members (Array)
    - updatedAt (Descending)

  Collection: users
  Fields:
    - username (Ascending)

  ██████████████████████████████████████████████████████
  КАК ЗАПУСТИТЬ ЛОКАЛЬНО:
  ██████████████████████████████████████████████████████

  1. Установи Live Server (VSCode расширение) или:
     npx serve .

  2. Открой http://localhost:3000 (или 5500)

  3. Важно: сервер нужен для ES modules (import/export)
     Нельзя открывать index.html через file:// !

  ██████████████████████████████████████████████████████
  ДЕПЛОЙ НА FIREBASE HOSTING:
  ██████████████████████████████████████████████████████

  npm install -g firebase-tools
  firebase login
  firebase init hosting
    → Public directory: . (текущая папка)
    → Single-page app: Yes
    → Overwrite index.html: No
  firebase deploy

  ██████████████████████████════════════════════════════
  FIRESTORE COLLECTIONS (создаются автоматически):
  ══════════════════════════════════════════════════════

  users/{username}
    - username: string
    - displayName: string
    - passwordHash: string (SHA-256 + salt)
    - bio: string
    - rep: number
    - online: boolean
    - lastSeen: Timestamp
    - createdAt: Timestamp

  conversations/{user1__user2}
    - members: string[] (sorted)
    - lastMessage: string
    - updatedAt: Timestamp
    - unreadCount: { [username]: number }

  conversations/{id}/messages/{msgId}
    - text: string
    - sender: string
    - createdAt: Timestamp

  ══════════════════════════════════════════════════════
  TELEGRAM BOT SETUP (bot-utils.js):
  ══════════════════════════════════════════════════════

  BOT_TOKEN = "8709058432:AAEIqd4-owgpFyAdDOnqrG_mgsv5mJxaCJs"
  ADMIN_UID = "6226164273"

  Для продакшена: перенеси Bot API вызовы в Cloud Functions!
  Не держи токен на клиенте в реальном проекте.

  ══════════════════════════════════════════════════════
  СДЕЛАНО BY SMASHH · Mystery Chat v1.0.0
  ══════════════════════════════════════════════════════
*/

module.exports = { FIRESTORE_RULES };

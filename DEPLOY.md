# Mystery Chat v3.0 · Deploy Guide
# Made by Smashh · Free forever on Firestore Spark

## ══ Что нового в v3 ══
- ✅ 10 тем (Dark, Light, Neon, Ocean, Sunset, Aurora, Matrix, Candy, Midnight, Liquid Glass)
- ✅ Liquid Glass с предупреждением о производительности
- ✅ "Запомнить меня" — автовход при следующем открытии
- ✅ Плавные переходы (slide, без fade flash) везде — экраны, вкладки, шаги авторизации
- ✅ Редактирование сообщений с пометкой "изменено" (как в TG)
- ✅ Автомиграция паролей v1→v2 (старые аккаунты работают снова)
- ✅ Snake: медленнее (130ms), бонусная еда, уровни
- ✅ Tetris: Hold piece, Ghost, Combo, 8 цветов
- ✅ 2048: CSS-transition плавные тайлы
- ✅ Pong: delta-time 60fps, шарик с хвостом, AI с погрешностью

## ══ Firestore Rules ══
# Firebase Console → Firestore Database → Rules

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

## ══ Firestore Indexes ══
# Firebase Console → Firestore → Indexes → Composite

1. Collection: conversations
   Fields:
     - members      → Arrays
     - updatedAt    → Descending
   Query scope: Collection

2. Collection: users
   Fields:
     - username     → Ascending
   Query scope: Collection

## ══ Про Storage ══
Storage НЕ используется (бесплатный план Spark не включает Storage по умолчанию).
Аватарки хранятся как URL (стоковые minotar.net или custom URL введённый вручную).
Сообщения — только текст.

## ══ Про пароли старых аккаунтов ══
В v3 добавлена автомиграция:
- При входе сначала проверяется новая соль (_mc_salt_v2)
- Если не совпадает — проверяется старая соль (mystery_salt_smashh_2024)
- При успехе со старой солью → автоматически перехэширует с новой
- Старые аккаунты теперь работают без каких-либо действий

## ══ File Structure ══
```
mystery-chat/
├── index.html          ← SPA entry point
├── styles.css          ← 10 тем, Liquid Glass, все стили
├── firebase-config.js  ← Firebase v10 (без Storage)
├── three-bg.js         ← Three.js + GLSL particles
├── ui-animations.js    ← GSAP slide transitions, toasts, themes
├── auth.js             ← Auth + remember me + password migration
├── chat.js             ← Realtime chat + edit + reactions + search
├── games.js            ← 4 playable games (Blob URL)
├── app.js              ← Main orchestrator
├── bot-utils.js        ← Telegram Bot placeholder
└── DEPLOY.md           ← Этот файл
```

## ══ GitHub Pages Deploy ══
Просто пушни все файлы в корень main ветки.
Settings → Pages → Source: Deploy from branch → main → / (root)

## ══ Firestore Free Limits (Spark plan) ══
- Reads:   50,000 / day
- Writes:  20,000 / day
- Deletes: 20,000 / day
- Storage: 1 GB
- Network: 10 GB / month

Для чата с несколькими сотнями пользователей — хватит с запасом.

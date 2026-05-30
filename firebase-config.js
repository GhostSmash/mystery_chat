// ═══════════════════════════════════════════════════════
// firebase-config.js  ·  Mystery Chat v2
// ═══════════════════════════════════════════════════════
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDW9jyliZDMF9tvQ_06FaHx016FAFcDR48",
  authDomain:        "mysteryychatt.firebaseapp.com",
  projectId:         "mysteryychatt",
  storageBucket:     "mysteryychatt.firebasestorage.app",
  messagingSenderId: "826080889440",
  appId:             "1:826080889440:web:2f4d818e9c410c76df1105",
  measurementId:     "G-38NKZ15D05",
};

const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const firestore = getFirestore(app);
const storage   = getStorage(app);

export { app, auth, firestore, storage };

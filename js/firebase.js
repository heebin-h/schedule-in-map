// Firebase 초기화. 다른 모듈은 여기서 db만 가져다 씀.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "../config.js";

if (!firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes("여기에")) {
  alert("config.js에 Firebase 설정을 붙여넣어야 합니다. README 참고.");
  throw new Error("Firebase config 미설정");
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export {
  ref, get, set, update, remove, push, onValue, onDisconnect, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

function hasFirebaseConfig(): boolean {
  return Boolean(
    firebaseConfig.apiKey?.trim() && firebaseConfig.projectId?.trim(),
  );
}

/**
 * Valid-shaped config so `initializeApp` succeeds during `next build` / Vercel
 * when env vars are not injected yet. Runtime on Vercel must still set
 * `NEXT_PUBLIC_FIREBASE_*` or the app will talk to a non-existent project.
 */
function buildPlaceholderConfig(): Record<string, string> {
  return {
    apiKey: "AIzaSyBuildPlaceholder00000000000000000",
    authDomain: "payround-build-placeholder.firebaseapp.com",
    projectId: "payround-build-placeholder",
    storageBucket: "payround-build-placeholder.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000",
  };
}

/** Singleton app — safe to import from any module (including SSR prerender). */
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  if (hasFirebaseConfig()) {
    return initializeApp({
      apiKey: firebaseConfig.apiKey!,
      authDomain: firebaseConfig.authDomain ?? "",
      projectId: firebaseConfig.projectId!,
      storageBucket: firebaseConfig.storageBucket ?? "",
      messagingSenderId: firebaseConfig.messagingSenderId ?? "",
      appId: firebaseConfig.appId ?? "",
    });
  }
  return initializeApp(buildPlaceholderConfig());
}

const app: FirebaseApp = getFirebaseApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export default app;

export function isFirebaseConfigured(): boolean {
  return hasFirebaseConfig();
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getDb(): Firestore {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

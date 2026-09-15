import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";

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
    // Intentionally not `AIzaSy…` — GitHub secret scanning matches that pattern.
    apiKey: "payround-build-placeholder-not-a-google-api-key",
    authDomain: "payround-build-placeholder.firebaseapp.com",
    projectId: "payround-build-placeholder",
    storageBucket: "payround-build-placeholder.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000",
  };
}

function buildEmulatorConfig(): Record<string, string> {
  return {
    apiKey: "demo-api-key",
    authDomain: "localhost",
    // Always demo-payround so Docker seed data and the app share one emulator project.
    projectId: "demo-payround",
    storageBucket: "demo-payround.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef",
  };
}

/** Named without a `use` prefix — not a React Hook (ESLint rules-of-hooks). */
function emulatorsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
}

/** Singleton app — safe to import from any module (including SSR prerender). */
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  if (emulatorsEnabled()) {
    return initializeApp(buildEmulatorConfig());
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

function createFirestore(appInstance: FirebaseApp): Firestore {
  if (emulatorsEnabled()) {
    // WebChannel against Docker-mapped Firestore often evaluates rules as
    // unauthenticated; long polling keeps Auth tokens attached reliably.
    try {
      return initializeFirestore(appInstance, {
        experimentalForceLongPolling: true,
      });
    } catch {
      return getFirestore(appInstance);
    }
  }
  return getFirestore(appInstance);
}

const app: FirebaseApp = getFirebaseApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = createFirestore(app);

let emulatorsConnected = false;
let storageEmulatorConnected = false;

function connectEmulatorsOnce(): void {
  if (emulatorsConnected || !emulatorsEnabled()) {
    return;
  }
  const authHost =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?.trim() ||
    "http://127.0.0.1:9099";
  const fsHost =
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST?.trim() ||
    "127.0.0.1";
  const fsPort = Number(
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080,
  );

  try {
    connectAuthEmulator(auth, authHost, { disableWarnings: true });
    connectFirestoreEmulator(db, fsHost, fsPort);
    emulatorsConnected = true;
    console.info(
      `[payround] Firebase emulators: auth=${authHost} firestore=${fsHost}:${fsPort}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.toLowerCase().includes("already")) {
      console.warn("[payround] emulator connect:", msg);
    }
    emulatorsConnected = true;
  }
}

connectEmulatorsOnce();

export default app;

/** Lazy Storage — `getStorage()` at import time can break RSC / Node prerender. */
let storageSingleton: FirebaseStorage | null = null;

export function isFirebaseConfigured(): boolean {
  return emulatorsEnabled() || hasFirebaseConfig();
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getDb(): Firestore {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageSingleton) {
    storageSingleton = getStorage(getFirebaseApp());
    if (emulatorsEnabled() && !storageEmulatorConnected) {
      const host =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST?.trim() ||
        "127.0.0.1";
      const port = Number(
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT || 9199,
      );
      try {
        connectStorageEmulator(storageSingleton, host, port);
        storageEmulatorConnected = true;
        console.info(`[payround] Storage emulator: ${host}:${port}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.toLowerCase().includes("already")) {
          console.warn("[payround] storage emulator connect:", msg);
        }
        storageEmulatorConnected = true;
      }
    }
  }
  return storageSingleton;
}

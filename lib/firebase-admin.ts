import * as fs from "node:fs";
import * as path from "node:path";
import * as admin from "firebase-admin";

let initialized = false;

/** Parsed Google service account JSON (snake_case fields from GCP console). */
type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function isValidAccount(
  a: ServiceAccountJson | null,
): a is ServiceAccountJson {
  return Boolean(
    a?.project_id && a.client_email && a.private_key?.includes("BEGIN PRIVATE KEY"),
  );
}

function tryParseJson(raw: string): ServiceAccountJson | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as ServiceAccountJson;
    return isValidAccount(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadServiceAccountFromFile(filePath: string): ServiceAccountJson | null {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  try {
    const raw = fs.readFileSync(abs, "utf8");
    return tryParseJson(raw);
  } catch (e) {
    console.error(
      "Payround: could not read FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS",
      abs,
      e,
    );
    return null;
  }
}

function parseServiceAccount(): ServiceAccountJson | null {
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (filePath) {
    const fromFile = loadServiceAccountFromFile(filePath);
    if (fromFile) {
      return fromFile;
    }
  }

  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = tryParseJson(jsonRaw);
    if (parsed) {
      return parsed;
    }
    console.error(
      "Payround: FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. Prefer FIREBASE_SERVICE_ACCOUNT_PATH pointing at the downloaded .json file.",
    );
  }

  return null;
}

/** Throws if Admin is not configured (needed for invite server actions). */
export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const account = parseServiceAccount();
  if (!account) {
    throw new Error(
      "Firebase Admin is not configured. Set one of: FIREBASE_SERVICE_ACCOUNT_JSON (single-line JSON string), FIREBASE_SERVICE_ACCOUNT_PATH (path to service account .json), or GOOGLE_APPLICATION_CREDENTIALS. Multi-line JSON in .env files is not supported — use a file path instead.",
    );
  }
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      }),
    });
    initialized = true;
  }
  return admin.app();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}

export async function verifyPayroundIdToken(
  idToken: string,
): Promise<admin.auth.DecodedIdToken> {
  const app = getFirebaseAdminApp();
  return admin.auth(app).verifyIdToken(idToken);
}

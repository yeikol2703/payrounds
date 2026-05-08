import * as admin from "firebase-admin";

let initialized = false;

/** Parsed Google service account JSON (snake_case fields from GCP console). */
type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function parseServiceAccount(): ServiceAccountJson | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ServiceAccountJson;
  } catch {
    console.error("Payround: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

/** Throws if Admin is not configured (needed for invite server actions). */
export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const account = parseServiceAccount();
  if (!account?.project_id || !account.client_email || !account.private_key) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (JSON string of your service account) for invite emails and invite acceptance.",
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

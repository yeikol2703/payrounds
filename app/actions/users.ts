"use server";

import { getAdminFirestore, verifyPayroundIdToken } from "@/lib/firebase-admin";

export type UserEmailLookup = {
  uid: string;
  email: string;
  displayName: string;
};

/**
 * Owner-only helper: find a registered user by email via Admin SDK.
 * Client Firestore rules cannot allow a collection query on `users.email`.
 */
export async function findUserByEmail(
  idToken: string,
  email: string,
): Promise<UserEmailLookup | null> {
  const decoded = await verifyPayroundIdToken(idToken);
  if (!decoded.uid) {
    throw new Error("Not authorized");
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return null;
  }

  const db = getAdminFirestore();
  const snap = await db
    .collection("users")
    .where("email", "==", normalized)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  const doc = snap.docs[0]!;
  const data = doc.data();
  return {
    uid: doc.id,
    email: String(data.email ?? normalized).toLowerCase(),
    displayName:
      String(data.displayName ?? "").trim() ||
      normalized.split("@")[0] ||
      normalized,
  };
}

"use server";

import * as admin from "firebase-admin";
import {
  getAdminFirestore,
  getFirebaseAdminApp,
  verifyPayroundIdToken,
} from "@/lib/firebase-admin";
import type { Subscription } from "@/lib/types";

function toCycleId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

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

/**
 * Deletes the signed-in user (Auth + Firestore profile), removes memberships,
 * and notifies subscription owners.
 */
export async function deleteAccount(idToken: string): Promise<void> {
  const decoded = await verifyPayroundIdToken(idToken);
  const uid = decoded.uid;
  if (!uid) {
    throw new Error("Not authorized");
  }

  const db = getAdminFirestore();
  const cycleId = toCycleId(new Date());
  const displayName =
    (decoded.name as string | undefined)?.trim() ||
    decoded.email?.split("@")[0] ||
    "Member";

  const memberSnaps = await db
    .collectionGroup("members")
    .where("uid", "==", uid)
    .get();

  for (const memberDoc of memberSnaps.docs) {
    const subRef = memberDoc.ref.parent.parent;
    if (!subRef) {
      continue;
    }
    const subId = subRef.id;
    const subSnap = await subRef.get();
    if (!subSnap.exists) {
      await memberDoc.ref.delete();
      continue;
    }

    const sub = { id: subSnap.id, ...subSnap.data() } as Subscription;
    const memberData = memberDoc.data() as {
      displayName?: string;
    };

    await db
      .collection("users")
      .doc(sub.ownerId)
      .collection("notifications")
      .add({
        type: "membership_left",
        subId,
        subName: sub.name,
        cycleId,
        fromUid: uid,
        fromDisplayName: memberData.displayName?.trim() || displayName,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    const membersCol = subRef.collection("members");
    const allMembers = await membersCol.get();
    const remaining = allMembers.docs.filter((d) => d.id !== uid);
    const newCount = remaining.length;
    const amountOwed =
      newCount === 0
        ? 0
        : parseFloat((sub.totalCost / (newCount + 1)).toFixed(2));

    const batch = db.batch();
    for (const d of remaining) {
      batch.update(d.ref, { amountOwed });
    }
    batch.delete(memberDoc.ref);
    await batch.commit();
  }

  const userRef = db.collection("users").doc(uid);
  const notifs = await userRef.collection("notifications").get();
  if (!notifs.empty) {
    const batch = db.batch();
    notifs.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await userRef.delete();

  const auth = admin.auth(getFirebaseAdminApp());
  await auth.deleteUser(uid);
}

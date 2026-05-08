import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Member,
  Subscription,
  SubscriptionStatus,
  SubscriptionWithMembers,
} from "@/lib/types";

const subsCol = () => collection(db, "subscriptions");
const membersCol = (subId: string) =>
  collection(db, "subscriptions", subId, "members");

const TX_RETRIES = 5;

/** Sort key for `createdAt` (Firestore Timestamp or plain object with seconds). */
function subscriptionCreatedAtMs(s: Subscription): number {
  const c = s.createdAt as Timestamp | undefined;
  if (c && typeof c.toMillis === "function") {
    return c.toMillis();
  }
  const sec = (c as { seconds?: number } | undefined)?.seconds;
  return typeof sec === "number" ? sec * 1000 : 0;
}

/**
 * Single-field `ownerId` query only — no composite index.
 * Drops `cancelled` in memory; sorts by `createdAt` descending in memory.
 */
function mapAndSortOwnerSubscriptions(
  docs: QueryDocumentSnapshot[],
): Subscription[] {
  return docs
    .map((d) => ({ id: d.id, ...d.data() }) as Subscription)
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => subscriptionCreatedAtMs(b) - subscriptionCreatedAtMs(a));
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getSubscriptionsByOwner(
  ownerId: string,
): Promise<Subscription[]> {
  const q = query(subsCol(), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return mapAndSortOwnerSubscriptions(snap.docs);
}

export function subscribeToSubscriptions(
  ownerId: string,
  onData: (subs: Subscription[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(subsCol(), where("ownerId", "==", ownerId));
  return onSnapshot(
    q,
    (snap) => {
      onData(mapAndSortOwnerSubscriptions(snap.docs));
    },
    (err) => onError?.(err),
  );
}

export async function getSubscription(
  subId: string,
): Promise<Subscription | null> {
  const snap = await getDoc(doc(db, "subscriptions", subId));
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...snap.data() } as Subscription;
}

export async function getMembers(subId: string): Promise<Member[]> {
  const snap = await getDocs(membersCol(subId));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Member);
}

export async function getSubscriptionWithMembers(
  subId: string,
): Promise<SubscriptionWithMembers | null> {
  const [sub, members] = await Promise.all([
    getSubscription(subId),
    getMembers(subId),
  ]);
  if (!sub) {
    return null;
  }
  return { ...sub, members };
}

export function subscribeToMembers(
  subId: string,
  onData: (members: Member[]) => void,
): Unsubscribe {
  return onSnapshot(membersCol(subId), (snap) => {
    const members = snap.docs.map(
      (d) => ({ uid: d.id, ...d.data() }) as Member,
    );
    onData(members);
  });
}

/** Uses collection group `members` — requires index (see README). */
export async function getSubscriptionsForMember(
  uid: string,
): Promise<Subscription[]> {
  const q = query(
    collectionGroup(db, "members"),
    where("uid", "==", uid),
  );
  const memberSnaps = await getDocs(q);
  const subIds = [
    ...new Set(
      memberSnaps.docs.map((d) => d.ref.parent.parent!.id),
    ),
  ];
  const subs = await Promise.all(subIds.map((id) => getSubscription(id)));
  return subs.filter(Boolean) as Subscription[];
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  ownerId: string;
  name: string;
  totalCost: number;
  dueDayOfMonth: number;
}

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<string> {
  const ref = await addDoc(subsCol(), {
    ...input,
    status: "active" as SubscriptionStatus,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export interface AddMemberInput {
  uid: string;
  email: string;
  displayName: string;
}

/**
 * Recalculates `amountOwed = totalCost / (memberCount + 1)` for every member.
 * Uses a transaction with retries because Firestore transactions cannot run collection queries.
 */
export async function addMember(
  subId: string,
  input: AddMemberInput,
): Promise<void> {
  const subRef = doc(db, "subscriptions", subId);

  for (let attempt = 0; attempt < TX_RETRIES; attempt++) {
    const membersSnap = await getDocs(membersCol(subId));
    if (membersSnap.docs.some((d) => d.id === input.uid)) {
      throw new Error("User is already a member of this subscription");
    }

    const existingRefs = membersSnap.docs.map((d) => d.ref);
    const newCount = membersSnap.docs.length + 1;

    try {
      await runTransaction(db, async (tx) => {
        const subSnap = await tx.get(subRef);
        if (!subSnap.exists()) {
          throw new Error("Subscription not found");
        }

        const sub = subSnap.data() as Subscription;
        const amountOwed = parseFloat(
          (sub.totalCost / (newCount + 1)).toFixed(2),
        );

        for (const memberDocRef of existingRefs) {
          const m = await tx.get(memberDocRef);
          if (!m.exists()) {
            throw new Error("retry");
          }
          tx.update(memberDocRef, { amountOwed });
        }

        const newMemberRef = doc(membersCol(subId), input.uid);
        tx.set(newMemberRef, {
          uid: input.uid,
          email: input.email,
          displayName: input.displayName,
          amountOwed,
          joinedAt: serverTimestamp(),
        });
      });
      return;
    } catch (e) {
      if ((e as Error).message === "retry" && attempt < TX_RETRIES - 1) {
        continue;
      }
      throw e;
    }
  }
}

export async function removeMember(subId: string, uid: string): Promise<void> {
  const subRef = doc(db, "subscriptions", subId);

  for (let attempt = 0; attempt < TX_RETRIES; attempt++) {
    const membersSnap = await getDocs(membersCol(subId));
    const remaining = membersSnap.docs.filter((d) => d.id !== uid);
    const remainingRefs = remaining.map((d) => d.ref);
    const newCount = remaining.length;

    try {
      await runTransaction(db, async (tx) => {
        const subSnap = await tx.get(subRef);
        if (!subSnap.exists()) {
          throw new Error("Subscription not found");
        }

        const sub = subSnap.data() as Subscription;
        const amountOwed =
          newCount === 0
            ? 0
            : parseFloat((sub.totalCost / (newCount + 1)).toFixed(2));

        for (const memberDocRef of remainingRefs) {
          const m = await tx.get(memberDocRef);
          if (!m.exists()) {
            throw new Error("retry");
          }
          tx.update(memberDocRef, { amountOwed });
        }

        tx.delete(doc(membersCol(subId), uid));
      });
      return;
    } catch (e) {
      if ((e as Error).message === "retry" && attempt < TX_RETRIES - 1) {
        continue;
      }
      throw e;
    }
  }
}

// ─── Update ─────────────────────────────────────────────────────────────────────

export async function updateSubscription(
  subId: string,
  updates: Partial<
    Pick<Subscription, "name" | "totalCost" | "dueDayOfMonth" | "status">
  >,
): Promise<void> {
  await updateDoc(doc(db, "subscriptions", subId), updates);
}

export async function cancelSubscription(subId: string): Promise<void> {
  await updateDoc(doc(db, "subscriptions", subId), {
    status: "cancelled" as SubscriptionStatus,
  });
}

/** @deprecated Use {@link getSubscriptionsByOwner}. */
export const listSubscriptionsForOwner = getSubscriptionsByOwner;

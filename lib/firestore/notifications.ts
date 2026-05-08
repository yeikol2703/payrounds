import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppNotification, NotificationType } from "@/lib/types";

const notifCol = (uid: string) =>
  collection(db, "users", uid, "notifications");

export function subscribeToNotifications(
  uid: string,
  onData: (notifs: AppNotification[]) => void,
): Unsubscribe {
  const q = query(notifCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as AppNotification,
    );
    onData(notifs);
  });
}

export async function getUnreadCount(uid: string): Promise<number> {
  const q = query(notifCol(uid), where("read", "==", false));
  const snap = await getDocs(q);
  return snap.size;
}

export interface CreateNotificationInput {
  recipientUid: string;
  type: NotificationType;
  subId: string;
  subName: string;
  cycleId: string;
  fromUid: string;
  fromDisplayName: string;
  /** Optional body line (e.g. rejection note for `payment_rejected`). */
  detail?: string | null;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  await addDoc(notifCol(input.recipientUid), {
    type: input.type,
    subId: input.subId,
    subName: input.subName,
    cycleId: input.cycleId,
    fromUid: input.fromUid,
    fromDisplayName: input.fromDisplayName,
    read: false,
    createdAt: serverTimestamp(),
    ...(input.detail != null && input.detail !== ""
      ? { detail: input.detail }
      : {}),
  });
}

export async function markAsRead(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(notifCol(uid), notifId), { read: true });
}

export async function markAllAsRead(uid: string): Promise<void> {
  const q = query(notifCol(uid), where("read", "==", false));
  const snap = await getDocs(q);
  if (snap.empty) {
    return;
  }

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

/** @deprecated Use {@link subscribeToNotifications} for reads. */
export async function listNotificationsForUser(
  userId: string,
): Promise<AppNotification[]> {
  const q = query(notifCol(userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
}

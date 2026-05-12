import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Cycle, CycleStatus, CycleWithPayments, Payment } from "@/lib/types";

/** Build cycle ID from a date — `"YYYY-MM"`. */
export function toCycleId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function currentCycleId(): string {
  return toCycleId(new Date());
}

const cyclesCol = (subId: string) =>
  collection(db, "subscriptions", subId, "cycles");

const paymentsCol = (subId: string, cycleId: string) =>
  collection(db, "subscriptions", subId, "cycles", cycleId, "payments");

export async function getCycle(
  subId: string,
  cycleId: string,
): Promise<Cycle | null> {
  const snap = await getDoc(doc(cyclesCol(subId), cycleId));
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...snap.data() } as Cycle;
}

export async function getCycles(subId: string): Promise<Cycle[]> {
  const q = query(cyclesCol(subId), orderBy("dueDate", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cycle);
}

/** @deprecated Use {@link getCycles}. */
export const listCyclesForSubscription = getCycles;

export async function getCycleWithPayments(
  subId: string,
  cycleId: string,
): Promise<CycleWithPayments | null> {
  const [cycle, paymentsSnap] = await Promise.all([
    getCycle(subId, cycleId),
    getDocs(paymentsCol(subId, cycleId)),
  ]);
  if (!cycle) {
    return null;
  }
  const payments = paymentsSnap.docs.map(
    (d) => ({ uid: d.id, ...d.data() } as Payment),
  );
  return { ...cycle, payments };
}

export function subscribeToCycle(
  subId: string,
  cycleId: string,
  onData: (cycle: Cycle | null) => void,
): Unsubscribe {
  return onSnapshot(doc(cyclesCol(subId), cycleId), (snap) => {
    if (!snap.exists()) {
      return onData(null);
    }
    onData({ id: snap.id, ...snap.data() } as Cycle);
  });
}

export function subscribeToPayments(
  subId: string,
  cycleId: string,
  onData: (payments: Payment[]) => void,
): Unsubscribe {
  return onSnapshot(paymentsCol(subId, cycleId), (snap) => {
    const payments = snap.docs.map(
      (d) => ({ uid: d.id, ...d.data() } as Payment),
    );
    onData(payments);
  });
}

export async function openCycle(
  subId: string,
  cycleId: string,
  dueDate: Date,
  members: Array<{ uid: string; amountOwed: number }>,
): Promise<void> {
  const cycleRef = doc(cyclesCol(subId), cycleId);

  await setDoc(cycleRef, {
    status: "open" as CycleStatus,
    dueDate: Timestamp.fromDate(dueDate),
    closedAt: null,
    closedBy: null,
  });

  const writes = members.map(({ uid, amountOwed }) =>
    setDoc(doc(paymentsCol(subId, cycleId), uid), {
      uid,
      status: "missing",
      proofImagePath: null,
      proofUploadedAt: null,
      confirmedAt: null,
      rejectionNote: null,
      amount: amountOwed,
    }),
  );
  await Promise.all(writes);
}

/**
 * Ensures `payments` for the current calendar cycle match `members` (amounts,
 * new rows for new members). Removes payment docs for uids no longer in `members`.
 */
export async function syncPaymentsForCurrentCycle(
  subId: string,
): Promise<void> {
  const cid = currentCycleId();
  const cycleRef = doc(cyclesCol(subId), cid);
  const cycleSnap = await getDoc(cycleRef);
  if (!cycleSnap.exists()) {
    return;
  }

  const membersCol = collection(db, "subscriptions", subId, "members");
  const [membersSnap, paymentsSnap] = await Promise.all([
    getDocs(membersCol),
    getDocs(paymentsCol(subId, cid)),
  ]);
  const memberUids = new Set(membersSnap.docs.map((d) => d.id));

  const batch = writeBatch(db);

  for (const p of paymentsSnap.docs) {
    if (!memberUids.has(p.id)) {
      batch.delete(doc(paymentsCol(subId, cid), p.id));
    }
  }

  for (const m of membersSnap.docs) {
    const mData = m.data() as { amountOwed?: number };
    const owed =
      typeof mData.amountOwed === "number" ? mData.amountOwed : 0;
    const pRef = doc(paymentsCol(subId, cid), m.id);
    const pSnap = paymentsSnap.docs.find((d) => d.id === m.id);
    if (pSnap) {
      batch.update(pRef, { amount: owed });
    } else {
      batch.set(pRef, {
        uid: m.id,
        status: "missing",
        proofImagePath: null,
        proofUploadedAt: null,
        confirmedAt: null,
        rejectionNote: null,
        amount: owed,
      });
    }
  }

  await batch.commit();
}

export async function closeCycle(
  subId: string,
  cycleId: string,
  ownerUid: string,
): Promise<void> {
  const paymentsSnap = await getDocs(paymentsCol(subId, cycleId));
  const allConfirmed = paymentsSnap.docs.every(
    (d) => (d.data() as Payment).status === "confirmed",
  );

  await updateDoc(doc(cyclesCol(subId), cycleId), {
    status: allConfirmed
      ? ("success" as CycleStatus)
      : ("closed_with_issues" as CycleStatus),
    closedAt: serverTimestamp(),
    closedBy: ownerUid,
  });
}

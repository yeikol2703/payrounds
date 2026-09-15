import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, getFirebaseStorage } from "@/lib/firebase";
import type { Payment, PaymentStatus } from "@/lib/types";

function paymentsCol(subId: string, cycleId: string) {
  return collection(
    db,
    "subscriptions",
    subId,
    "cycles",
    cycleId,
    "payments",
  );
}

export async function listPaymentsForCycle(
  subId: string,
  cycleId: string,
): Promise<Payment[]> {
  const snap = await getDocs(paymentsCol(subId, cycleId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      uid: d.id,
    } as Payment;
  });
}

function proofStoragePath(subId: string, cycleId: string, uid: string): string {
  return `proofs/${subId}/${cycleId}/${uid}`;
}

function paymentRef(subId: string, cycleId: string, uid: string) {
  return doc(db, "subscriptions", subId, "cycles", cycleId, "payments", uid);
}

export async function uploadProof(
  subId: string,
  cycleId: string,
  uid: string,
  file: File,
): Promise<string> {
  const path = proofStoragePath(subId, cycleId, uid);
  const storageRef = ref(getFirebaseStorage(), path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      subId,
      cycleId,
      uid,
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);

  await updateDoc(paymentRef(subId, cycleId, uid), {
    status: "pending_review" as PaymentStatus,
    proofImagePath: path,
    proofUploadedAt: serverTimestamp(),
    rejectionNote: null,
  });

  return downloadUrl;
}

export async function confirmPayment(
  subId: string,
  cycleId: string,
  uid: string,
): Promise<void> {
  await updateDoc(paymentRef(subId, cycleId, uid), {
    status: "confirmed" as PaymentStatus,
    confirmedAt: serverTimestamp(),
    rejectionNote: null,
  });
}

export async function rejectPayment(
  subId: string,
  cycleId: string,
  uid: string,
  note: string,
): Promise<void> {
  const path = proofStoragePath(subId, cycleId, uid);
  try {
    // Storage emulator can hang on delete; don't block the Firestore update.
    await Promise.race([
      deleteObject(ref(getFirebaseStorage(), path)),
      new Promise<never>((_, reject) => {
        window.        setTimeout(
          () => reject(new Error("storage delete timed out")),
          8_000,
        );
      }),
    ]);
  } catch {
    // File may not exist / emulator flake
  }

  await updateDoc(paymentRef(subId, cycleId, uid), {
    status: "missing" as PaymentStatus,
    proofImagePath: null,
    proofUploadedAt: null,
    confirmedAt: null,
    rejectionNote: note.trim() || null,
  });
}

export async function getProofUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), storagePath));
}

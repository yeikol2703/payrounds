import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser } from "@/lib/types";

/** Lookup by exact email (lowercased). Requires a users index on `email` if scale grows. */
export async function getAppUserByEmail(
  email: string,
): Promise<AppUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const q = query(collection(db, "users"), where("email", "==", normalized));
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  const d = snap.docs[0]!;
  return { uid: d.id, ...d.data() } as AppUser;
}

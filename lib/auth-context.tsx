"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  type DocumentSnapshot,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import type { AppUser, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  appUser: AppUser | null;
  role: UserRole | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      try {
        if (firebaseUser) {
          const profile = await getOrCreateUserProfile(firebaseUser);
          setAppUser(profile);
        } else {
          setAppUser(null);
        }
      } catch (err) {
        console.error("Payround: failed to load user profile", err);
        setAppUser(null);
        if (firebaseUser) {
          try {
            await firebaseSignOut(auth);
          } catch {
            /* ignore secondary sign-out errors */
          }
        }
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    let profile = await getOrCreateUserProfile(result.user, "owner");

    if (profile.role !== "owner") {
      await updateDoc(doc(db, "users", result.user.uid), { role: "owner" });
      profile = { ...profile, role: "owner" };
    }

    setAppUser(profile);
    router.push("/dashboard");
  }, [router]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, trimmed, password);
    const profile = await getOrCreateUserProfile(cred.user, "member");
    setAppUser(profile);
  }, []);

  const registerWithPassword = useCallback(
    async (email: string, password: string, displayName: string) => {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName =
        displayName.trim() ||
        trimmedEmail.split("@")[0] ||
        "Member";

      const cred = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password,
      );
      await updateProfile(cred.user, { displayName: trimmedName });

      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: trimmedEmail,
        displayName: trimmedName,
        role: "member" as const,
        createdAt: serverTimestamp(),
      });

      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        setAppUser(appUserFromFirestoreSnapshot(snap, cred.user, "member"));
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setAppUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        appUser,
        role: appUser?.role ?? null,
        loading,
        signInWithGoogle,
        signInWithPassword,
        registerWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

/** Maps Firebase Auth errors to short, user-facing copy. */
export function authErrorToMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: string }).code);
    switch (code) {
      case "auth/email-already-in-use":
        return "That email is already registered. Sign in instead.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Wrong email or password. Try again.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a moment and try again.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        break;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

function appUserFromFirestoreSnapshot(
  snap: DocumentSnapshot,
  firebaseUser: User,
  defaultRole: UserRole = "member",
): AppUser {
  const data = snap.data()!;
  return {
    uid: snap.id,
    email:
      ((data.email as string) ?? firebaseUser.email ?? "").toLowerCase(),
    displayName:
      (data.displayName as string) ??
      firebaseUser.displayName ??
      firebaseUser.email ??
      "User",
    role: (data.role as UserRole) ?? defaultRole,
    createdAt: data.createdAt,
  } as AppUser;
}

async function getOrCreateUserProfile(
  firebaseUser: User,
  defaultRole: UserRole = "member",
): Promise<AppUser> {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return appUserFromFirestoreSnapshot(snap, firebaseUser, defaultRole);
  }

  const newUser = {
    uid: firebaseUser.uid,
    email: (firebaseUser.email ?? "").toLowerCase(),
    displayName:
      firebaseUser.displayName ?? firebaseUser.email ?? "User",
    role: defaultRole,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, newUser);
  const created = await getDoc(ref);
  return { uid: created.id, ...created.data() } as AppUser;
}

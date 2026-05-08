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
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
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
  sendMagicLink: (email: string, redirectUrl: string) => Promise<void>;
  /** Pass `{ skipRedirect: true }` when completing sign-in on `/invite/[token]/confirm` so the page can finish invite acceptance first. */
  completeMagicLinkSignIn: (options?: {
    skipRedirect?: boolean;
  }) => Promise<void>;
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

    // Google SSO is always the owner path — correct a stale "member" role.
    if (profile.role !== "owner") {
      await updateDoc(doc(db, "users", result.user.uid), { role: "owner" });
      profile = { ...profile, role: "owner" };
    }

    setAppUser(profile);
    router.push("/dashboard");
  }, [router]);

  const sendMagicLink = useCallback(
    async (email: string, redirectUrl: string) => {
      await sendSignInLinkToEmail(auth, email, {
        url: redirectUrl,
        handleCodeInApp: true,
      });
      localStorage.setItem("emailForSignIn", email);
    },
    [],
  );

  const completeMagicLinkSignIn = useCallback(
    async (options?: { skipRedirect?: boolean }) => {
      if (typeof window === "undefined") {
        return;
      }
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        router.replace("/login");
        return;
      }

      let email = localStorage.getItem("emailForSignIn");
      if (!email) {
        email =
          window.prompt("Please enter your email to confirm sign-in") || "";
      }
      if (!email) {
        throw new Error("Email is required to complete sign-in.");
      }

      const result = await signInWithEmailLink(
        auth,
        email,
        window.location.href,
      );
      localStorage.removeItem("emailForSignIn");

      const profile = await getOrCreateUserProfile(result.user, "member");
      setAppUser(profile);
      if (!options?.skipRedirect) {
        router.push("/pay");
      }
    },
    [router],
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
        sendMagicLink,
        completeMagicLinkSignIn,
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

async function getOrCreateUserProfile(
  firebaseUser: User,
  defaultRole: UserRole = "member",
): Promise<AppUser> {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
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

"use server";

import { randomUUID } from "crypto";
import { Resend } from "resend";
import * as admin from "firebase-admin";
import {
  getAdminFirestore,
  verifyPayroundIdToken,
} from "@/lib/firebase-admin";
import type { PendingInvite, Subscription } from "@/lib/types";

function toCycleId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export type InvitePublicStatus = "valid" | "expired" | "not_found" | "accepted";

export type InvitePublicPayload = {
  status: InvitePublicStatus;
  subName: string;
  ownerDisplayName: string;
  invitedEmail: string;
};

function inviteRef(db: admin.firestore.Firestore, token: string) {
  return db.collection("invites").doc(token);
}

/** Public read for invite landing (no auth). Uses Admin SDK. */
export async function getInvitePublic(
  token: string,
): Promise<InvitePublicPayload> {
  if (!token || token.length < 10) {
    return {
      status: "not_found",
      subName: "",
      ownerDisplayName: "",
      invitedEmail: "",
    };
  }

  try {
    const db = getAdminFirestore();
    const snap = await inviteRef(db, token).get();
    if (!snap.exists) {
      return {
        status: "not_found",
        subName: "",
        ownerDisplayName: "",
        invitedEmail: "",
      };
    }

    const data = snap.data() as Omit<PendingInvite, "id">;
    const expiresAt = data.expiresAt as admin.firestore.Timestamp | undefined;
    const expiresMs = expiresAt?.toMillis?.() ?? 0;
    if (expiresMs < Date.now()) {
      return {
        status: "expired",
        subName: data.subName ?? "",
        ownerDisplayName: data.ownerDisplayName ?? "",
        invitedEmail: data.invitedEmail ?? "",
      };
    }
    if (data.accepted) {
      return {
        status: "accepted",
        subName: data.subName ?? "",
        ownerDisplayName: data.ownerDisplayName ?? "",
        invitedEmail: data.invitedEmail ?? "",
      };
    }

    return {
      status: "valid",
      subName: data.subName ?? "",
      ownerDisplayName: data.ownerDisplayName ?? "",
      invitedEmail: data.invitedEmail ?? "",
    };
  } catch (e) {
    console.error("getInvitePublic", e);
    return {
      status: "not_found",
      subName: "",
      ownerDisplayName: "",
      invitedEmail: "",
    };
  }
}

/**
 * Creates `/invites/{token}` and attempts to send Resend email.
 * Verifies `idToken` belongs to `ownerId` and owns `subId`.
 * If email fails (e.g. Resend test limits) or Resend is not configured, the invite
 * document is still written and `emailSent` is false so the client can show the link.
 */
export async function sendInvite(
  idToken: string,
  email: string,
  subId: string,
  subName: string,
  ownerDisplayName: string,
  ownerId: string,
): Promise<{ token: string; emailSent: boolean }> {
  const invitedEmail = email.trim().toLowerCase();
  if (!invitedEmail.includes("@")) {
    throw new Error("Invalid email");
  }

  const decoded = await verifyPayroundIdToken(idToken);
  if (decoded.uid !== ownerId) {
    throw new Error("Not authorized");
  }

  const db = getAdminFirestore();
  const subSnap = await db.collection("subscriptions").doc(subId).get();
  if (!subSnap.exists) {
    throw new Error("Subscription not found");
  }
  const sub = subSnap.data() as Subscription;
  if (sub.ownerId !== ownerId) {
    throw new Error("Not authorized");
  }

  const token = randomUUID();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + INVITE_TTL_MS,
  );

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const inviteUrl = `${base}/invite/${token}`;

  await inviteRef(db, token).set({
    token,
    subId,
    subName: subName.trim(),
    invitedEmail,
    ownerId,
    ownerDisplayName: ownerDisplayName.trim(),
    expiresAt,
    accepted: false,
  });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "sendInvite: RESEND_API_KEY is not configured; invite saved without email",
      { subId, invitedEmail },
    );
    return { token, emailSent: false };
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

  try {
    const { error } = await resend.emails.send({
      from,
      to: invitedEmail,
      subject: `You've been invited to share ${subName.trim()} on PayRounds`,
      html: `
      <p>Hi,</p>
      <p><strong>${ownerDisplayName.trim()}</strong> invited you to split <strong>${subName.trim()}</strong> on Payround.</p>
      <p><a href="${inviteUrl}">Open your invite</a> (link expires in 72 hours).</p>
      <p style="color:#64748b;font-size:12px;">If you did not expect this, you can ignore this email.</p>
    `,
    });

    if (error) {
      console.error("sendInvite: Resend returned an error (invite still created)", {
        subId,
        invitedEmail,
        error,
      });
      return { token, emailSent: false };
    }
  } catch (e) {
    console.error("sendInvite: Resend send threw (invite still created)", {
      subId,
      invitedEmail,
      e,
    });
    return { token, emailSent: false };
  }

  return { token, emailSent: true };
}

const TX_RETRIES = 5;

/**
 * After a member signs in with email/password (or registers): add them to the
 * subscription, sync current cycle payments, mark invite accepted.
 */
export async function acceptInviteJoin(
  token: string,
  idToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!token?.trim()) {
    return { ok: false, error: "Missing invite token" };
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await verifyPayroundIdToken(idToken);
  } catch {
    return { ok: false, error: "Invalid session" };
  }

  const email = (decoded.email ?? "").toLowerCase();
  if (!email) {
    return { ok: false, error: "Your account has no email on file" };
  }

  const db = getAdminFirestore();
  const invRef = inviteRef(db, token);
  const invSnap = await invRef.get();
  if (!invSnap.exists) {
    return { ok: false, error: "Invite not found" };
  }

  const invite = invSnap.data() as Omit<PendingInvite, "id">;
  if (invite.accepted) {
    return { ok: false, error: "already_accepted" };
  }

  const exp = invite.expiresAt as admin.firestore.Timestamp | undefined;
  if (!exp || exp.toMillis() < Date.now()) {
    return { ok: false, error: "Invite expired" };
  }

  if (invite.invitedEmail !== email) {
    return {
      ok: false,
      error:
        "Signed-in email does not match this invite. Use the same email you were invited with.",
    };
  }

  const subId = invite.subId;
  const uid = decoded.uid;
  const displayName =
    (decoded.name as string | undefined)?.trim() ||
    email.split("@")[0] ||
    "Member";

  const subRef = db.collection("subscriptions").doc(subId);
  const membersCol = subRef.collection("members");

  for (let attempt = 0; attempt < TX_RETRIES; attempt++) {
    const membersSnap = await membersCol.get();
    if (membersSnap.docs.some((d) => d.id === uid)) {
      await invRef.update({ accepted: true });
      await syncCyclePaymentsForMembers(db, subRef, membersCol);
      return { ok: true };
    }

    const existingRefs = membersSnap.docs.map((d) => d.ref);
    const newCount = membersSnap.docs.length + 1;

    try {
      await db.runTransaction(async (tx) => {
        const invDoc = await tx.get(invRef);
        if (!invDoc.exists) {
          throw new Error("Invite not found");
        }
        const invData = invDoc.data() as Omit<PendingInvite, "id">;
        if (invData.accepted) {
          throw new Error("already_accepted");
        }

        const subDoc = await tx.get(subRef);
        if (!subDoc.exists) {
          throw new Error("Subscription not found");
        }
        const sub = subDoc.data() as Subscription;

        for (const ref of existingRefs) {
          const m = await tx.get(ref);
          if (!m.exists) {
            throw new Error("retry");
          }
        }

        const amountOwed = parseFloat(
          (sub.totalCost / (newCount + 1)).toFixed(2),
        );

        for (const ref of existingRefs) {
          tx.update(ref, { amountOwed });
        }

        tx.set(membersCol.doc(uid), {
          uid,
          email,
          displayName,
          amountOwed,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.update(invRef, { accepted: true });
      });
      await syncCyclePaymentsForMembers(db, subRef, membersCol);
      return { ok: true };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "already_accepted") {
        await syncCyclePaymentsForMembers(db, subRef, membersCol);
        return { ok: true };
      }
      if (msg === "retry" && attempt < TX_RETRIES - 1) {
        continue;
      }
      if (msg === "retry") {
        return { ok: false, error: "Could not join — try again." };
      }
      console.error("acceptInviteJoin transaction", e);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Could not join subscription",
      };
    }
  }

  return { ok: false, error: "Could not join subscription" };
}

async function syncCyclePaymentsForMembers(
  db: admin.firestore.Firestore,
  subRef: admin.firestore.DocumentReference,
  membersCol: admin.firestore.CollectionReference,
): Promise<void> {
  const cycleId = toCycleId(new Date());
  const cycleRef = subRef.collection("cycles").doc(cycleId);
  const cycleSnap = await cycleRef.get();
  if (!cycleSnap.exists) {
    return;
  }

  const paymentsCol = cycleRef.collection("payments");
  const membersAfter = await membersCol.get();
  const batch = db.batch();
  for (const m of membersAfter.docs) {
    const mData = m.data() as { amountOwed?: number };
    const owed = typeof mData.amountOwed === "number" ? mData.amountOwed : 0;
    const pRef = paymentsCol.doc(m.id);
    const pSnap = await pRef.get();
    if (pSnap.exists) {
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

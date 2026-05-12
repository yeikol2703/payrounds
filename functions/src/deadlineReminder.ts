import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { admin } from "./initAdmin";

import {
  TIME_ZONE,
  getCostaRicaYMD,
  isSevenDaysBeforeDueThisMonth,
  toCycleIdInCostaRica,
} from "./crCalendar";

/**
 * Daily 09:00 CR: for subs whose due is in 7 days, notify owner + email if any payment not confirmed.
 */
export const deadlineReminder = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const cycleId = toCycleIdInCostaRica(now);

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resend = resendKey ? new Resend(resendKey) : null;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

    const subsSnap = await db
      .collection("subscriptions")
      .where("status", "==", "active")
      .get();

    let notified = 0;
    let emailsSent = 0;

    for (const subDoc of subsSnap.docs) {
      const subId = subDoc.id;
      const sub = subDoc.data() as {
        ownerId?: string;
        name?: string;
        dueDayOfMonth?: number;
      };
      const ownerId = sub.ownerId;
      const subName = (sub.name ?? "Subscription").trim();
      const dueDayOfMonth =
        typeof sub.dueDayOfMonth === "number" ? sub.dueDayOfMonth : 15;

      if (!ownerId || !isSevenDaysBeforeDueThisMonth(dueDayOfMonth, now)) {
        continue;
      }

      const paymentsSnap = await db
        .collection("subscriptions")
        .doc(subId)
        .collection("cycles")
        .doc(cycleId)
        .collection("payments")
        .get();

      if (paymentsSnap.empty) {
        continue;
      }

      const anyNotConfirmed = paymentsSnap.docs.some((d) => {
        const st = (d.data() as { status?: string }).status;
        return st !== "confirmed";
      });
      if (!anyNotConfirmed) {
        continue;
      }

      const todayKey = getCostaRicaYMD(now);
      const notifDocId = `deadline-${subId}-${cycleId}-${todayKey.year}-${String(todayKey.month).padStart(2, "0")}-${String(todayKey.day).padStart(2, "0")}`;
      const notifRef = db
        .collection("users")
        .doc(ownerId)
        .collection("notifications")
        .doc(notifDocId);

      await notifRef.set(
        {
          type: "deadline_reminder",
          subId,
          subName,
          cycleId,
          fromUid: "system",
          fromDisplayName: "Payround",
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      notified += 1;

      const ownerSnap = await db.collection("users").doc(ownerId).get();
      const ownerEmail = (ownerSnap.data() as { email?: string } | undefined)
        ?.email;
      if (!resend || !ownerEmail?.includes("@")) {
        if (!resendKey) {
          logger.warn("deadlineReminder: RESEND_API_KEY missing, skip email", {
            subId,
          });
        }
        continue;
      }

      try {
        const { error } = await resend.emails.send({
          from: fromEmail,
          to: ownerEmail,
          subject: `Payment due in 7 days — ${subName}`,
          html: `<p>Some members have not confirmed payment for <strong>${escapeHtml(subName)}</strong> (cycle <strong>${escapeHtml(cycleId)}</strong>).</p><p>Open Payround to review.</p>`,
        });
        if (error) {
          logger.error("deadlineReminder: Resend error", { subId, error });
        } else {
          emailsSent += 1;
        }
      } catch (e) {
        logger.error("deadlineReminder: email send failed", { subId, e });
      }
    }

    logger.info("deadlineReminder: done", {
      cycleId,
      subscriptionsChecked: subsSnap.size,
      notificationsUpserted: notified,
      emailsSent,
    });
  },
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

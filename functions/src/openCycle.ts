import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { admin } from "./initAdmin";
import {
  TIME_ZONE,
  getCostaRicaYMD,
  lastDayOfCalendarMonth,
  toCycleIdInCostaRica,
} from "./crCalendar";

function toCycleId(now: Date): string {
  return toCycleIdInCostaRica(now);
}

/** Noon local Costa Rica as a UTC `Date` (CR is UTC−6, no DST). */
function noonCostaRicaUtc(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, 18, 0, 0, 0));
}

function computeDueDate(now: Date, dueDayOfMonth: number): Date {
  const { year, month } = getCostaRicaYMD(now);
  const dim = lastDayOfCalendarMonth(year, month);
  const d = Math.min(dueDayOfMonth, dim);
  let dueDate = noonCostaRicaUtc(year, month, d);
  if (dueDate.getTime() < now.getTime()) {
    let nm = month + 1;
    let ny = year;
    if (nm > 12) {
      nm = 1;
      ny += 1;
    }
    const dim2 = lastDayOfCalendarMonth(ny, nm);
    const d2 = Math.min(dueDayOfMonth, dim2);
    dueDate = noonCostaRicaUtc(ny, nm, d2);
  }
  return dueDate;
}

/**
 * 08:00 America/Costa_Rica on the 1st of every month.
 * Opens `subscriptions/{subId}/cycles/{YYYY-MM}` and payment rows for each member.
 */
export const openCycle = onSchedule(
  {
    schedule: "0 8 1 * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const cycleId = toCycleId(now);

    const subsSnap = await db
      .collection("subscriptions")
      .where("status", "==", "active")
      .get();

    let opened = 0;
    let skipped = 0;

    for (const subDoc of subsSnap.docs) {
      const subId = subDoc.id;
      const data = subDoc.data() as {
        dueDayOfMonth?: number;
        ownerId?: string;
      };
      const dueDayOfMonth =
        typeof data.dueDayOfMonth === "number" ? data.dueDayOfMonth : 15;

      const cycleRef = db
        .collection("subscriptions")
        .doc(subId)
        .collection("cycles")
        .doc(cycleId);

      const existing = await cycleRef.get();
      if (existing.exists) {
        skipped += 1;
        continue;
      }

      const membersSnap = await db
        .collection("subscriptions")
        .doc(subId)
        .collection("members")
        .get();

      const dueDate = computeDueDate(now, dueDayOfMonth);

      let batch = db.batch();
      let ops = 0;

      batch.set(cycleRef, {
        status: "open",
        dueDate: Timestamp.fromDate(dueDate),
        closedAt: null,
        closedBy: null,
      });
      ops += 1;

      for (const m of membersSnap.docs) {
        if (ops >= 500) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
        const member = m.data() as { uid?: string; amountOwed?: number };
        const uid = m.id;
        const amountOwed =
          typeof member.amountOwed === "number" ? member.amountOwed : 0;

        const payRef = cycleRef.collection("payments").doc(uid);
        batch.set(payRef, {
          uid,
          status: "missing",
          proofImagePath: null,
          proofUploadedAt: null,
          confirmedAt: null,
          rejectionNote: null,
          amount: amountOwed,
        });
        ops += 1;
      }

      await batch.commit();
      opened += 1;
      logger.info("openCycle: opened cycle", { subId, cycleId, memberCount: membersSnap.size });
    }

    logger.info("openCycle: done", {
      cycleId,
      activeSubscriptions: subsSnap.size,
      opened,
      skippedExisting: skipped,
    });
  },
);

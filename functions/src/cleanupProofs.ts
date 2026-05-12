import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { admin } from "./initAdmin";
import { TIME_ZONE } from "./crCalendar";

const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

function parseUploadedAt(metadata: Record<string, string> | undefined): number | null {
  const raw = metadata?.uploadedAt?.trim();
  if (!raw) {
    return null;
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Daily 02:00 CR: delete old proof objects in Storage; clear stale `proofImagePath` on payments.
 */
export const cleanupProofs = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const cutoff = Date.now() - RETENTION_MS;

    let storageDeleted = 0;
    let storageErrors = 0;

    const [files] = await bucket.getFiles({ prefix: "proofs/" });
    for (const file of files) {
      try {
        const [meta] = await file.getMetadata();
        const custom = (meta.metadata ?? {}) as Record<string, string>;
        const uploadedMs = parseUploadedAt(custom);
        if (uploadedMs == null || uploadedMs >= cutoff) {
          continue;
        }
        await file.delete().catch((err: { code?: number }) => {
          if (err?.code === 404) {
            return;
          }
          throw err;
        });
        storageDeleted += 1;
      } catch (e) {
        storageErrors += 1;
        logger.error("cleanupProofs: storage file error", {
          name: file.name,
          e,
        });
      }
    }

    const cutoffTs = Timestamp.fromMillis(cutoff);
    const paymentsSnap = await db
      .collectionGroup("payments")
      .where("proofUploadedAt", "<", cutoffTs)
      .get();

    let firestoreUpdated = 0;
    const batchSize = 400;
    let batch = db.batch();
    let ops = 0;

    for (const docSnap of paymentsSnap.docs) {
      const data = docSnap.data() as { proofImagePath?: string | null };
      if (data.proofImagePath == null || data.proofImagePath === "") {
        continue;
      }
      batch.update(docSnap.ref, {
        proofImagePath: null,
      });
      ops += 1;
      firestoreUpdated += 1;
      if (ops >= batchSize) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) {
      await batch.commit();
    }

    logger.info("cleanupProofs: done", {
      storageFilesScanned: files.length,
      storageDeleted,
      storageErrors,
      paymentDocsMatchingOldProof: paymentsSnap.size,
      paymentDocsUpdated: firestoreUpdated,
    });
  },
);

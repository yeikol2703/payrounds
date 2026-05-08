import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

/** Deletes proof images older than retention policy (e.g. 60 days). */
export const cleanupProofs = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    logger.info("cleanupProofs: remove expired proof objects from Storage");
    // TODO: list Storage prefix, delete objects older than 60 days per metadata
  },
);

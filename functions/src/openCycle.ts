import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

/** Runs on the 1st of each month (UTC) — adjust timezone as needed. */
export const openCycle = onSchedule(
  {
    schedule: "0 0 1 * *",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    logger.info(
      "openCycle: create new billing cycles for active subscriptions",
    );
    // TODO: query Firestore, open next cycle per subscription rules
  },
);

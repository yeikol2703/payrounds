import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

/** Example: daily check for cycles due in 7 days. */
export const deadlineReminder = onSchedule(
  {
    schedule: "every day 09:00",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    logger.info("deadlineReminder: notify members before due date");
    // TODO: query upcoming due dates, enqueue notifications / email
  },
);

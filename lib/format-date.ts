import type { Timestamp } from "firebase/firestore";

/** Format Firestore Timestamp / Date-like for card footers. */
export function formatCreatedAt(value: unknown): string {
  let date: Date | null = null;
  if (value && typeof value === "object" && "toDate" in value) {
    const ts = value as Timestamp;
    if (typeof ts.toDate === "function") {
      date = ts.toDate();
    }
  } else if (value instanceof Date) {
    date = value;
  }
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

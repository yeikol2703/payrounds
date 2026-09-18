"use client";

/** Visible only when the app is wired to Firebase emulators (local Docker). */
export function EmulatorBanner() {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="emulator-banner"
      className="pr-alert-warning border-b px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide"
    >
      LOCAL EMULATOR · Docker Auth/Firestore/Storage — not production
    </div>
  );
}

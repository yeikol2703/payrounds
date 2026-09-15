import type { NextConfig } from "next";

/**
 * Force-inline emulator flags for the browser bundle.
 * Next sometimes leaves `process.env.NEXT_PUBLIC_*` unresolved in client
 * chunks when the var only exists on the process env (not in .env.local),
 * which made the app hit production Auth while SSR used emulators.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR:
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR ?? "",
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "",
    NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST:
      process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ?? "",
    NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT:
      process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT ?? "",
  },
  // Avoid dev-only SegmentViewNode / client manifest issues that can blank the UI (Windows + Turbopack).
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;

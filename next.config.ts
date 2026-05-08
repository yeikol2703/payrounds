import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Avoid dev-only SegmentViewNode / client manifest issues that can blank the UI (Windows + Turbopack).
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;

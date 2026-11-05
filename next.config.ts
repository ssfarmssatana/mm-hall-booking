import type { NextConfig } from "next";

process.env.TZ = process.env.TZ || "Asia/Kolkata";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // backup restore uploads
  },
};

export default nextConfig;

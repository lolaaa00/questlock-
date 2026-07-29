import type { NextConfig } from "next";
import * as path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Use the cwd at build time so this works on Vercel's Linux runners and on
  // local Windows alike. Avoid hardcoding any one developer's path.
  outputFileTracingRoot: path.resolve(process.cwd()),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;

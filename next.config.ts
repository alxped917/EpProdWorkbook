import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "bwip-js", "@prisma/client"],
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;

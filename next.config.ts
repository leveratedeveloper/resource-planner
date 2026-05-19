import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // PERINGATAN: Ini mengizinkan proses build sukses
    // meskipun ada error TypeScript.
    ignoreBuildErrors: true,
  },
  // Workerd-specific packages — keep them out of Next's pre-bundling so the
  // OpenNext/Cloudflare adapter can resolve the workerd export conditions
  // correctly at deploy time.
  serverExternalPackages: ["pg", "pg-cloudflare", "mysql2"],
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());

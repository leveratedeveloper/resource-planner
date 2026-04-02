import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // PERINGATAN: Ini mengizinkan proses build sukses
    // meskipun ada error TypeScript.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

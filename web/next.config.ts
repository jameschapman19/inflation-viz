import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the installed compiler API: detached CLI output can be lost in
  // container builds. This keeps production TypeScript checking enabled.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;

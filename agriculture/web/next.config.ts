import type { NextConfig } from 'next';
const config: NextConfig = {
  // Keep production TypeScript checking enabled through the compiler API,
  // matching inflation-viz's container-compatible build.
  experimental: { useTypeScriptCli: false },
};
export default config;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The catalog JSON is read on the server only; keep it out of client bundles.
  serverExternalPackages: ["twilio"],
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
    "/**": ["./data/**/*"],
  },
};

export default nextConfig;

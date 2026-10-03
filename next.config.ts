import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (docker/Dockerfile).
  output: "standalone",
  // Dev Server Function traces print raw arguments, including passwords.
  logging: { serverFunctions: false },
};

export default nextConfig;

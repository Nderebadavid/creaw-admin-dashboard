import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev Server Function traces print raw arguments, including passwords.
  logging: { serverFunctions: false },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/%EC%98%AC%EB%A6%AC%EA%B8%B0",
        destination: "/upload",
      },
      {
        source: "/올리기",
        destination: "/upload",
      },
    ];
  },
};

export default nextConfig;

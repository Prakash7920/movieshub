
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // GitHub Pages static export
  output: "export",

  // Repository deployment path
  basePath: "/movieshub",
  assetPrefix: "/movieshub/",

  // Generate static HTML pages
  trailingSlash: true,

  // GitHub Pages does not support Next.js image optimization
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;

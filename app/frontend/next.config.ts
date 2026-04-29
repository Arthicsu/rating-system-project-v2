import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  output: 'standalone',
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

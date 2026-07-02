import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  output: 'standalone',
  poweredByHeader: false,
  // pdf.mjs (pdfjs-dist) - это сам по себе webpack-бандл; при повторном бандлинге
  // webpack-dev его внутренний рантайм падает (Object.defineProperty called on
  // non-object). Транспиляция обоих пакетов через Next устраняет конфликт.
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

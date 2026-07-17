// Конфиг в .mjs, а не .ts: для загрузки next.config.ts на "next start" нужен
// пакет typescript в рантайме, а он dev-зависимость и в прод-образ не попадает
// (см. Dockerfile, стадия prod-deps). Типизация сохранена через JSDoc.

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  // Без output: 'standalone'. Прод-образ запускает "next start" через pnpm,
  // а next start со standalone-выводом несовместим (см. Dockerfile).
  poweredByHeader: false,
  // pdf.mjs (pdfjs-dist) - это сам по себе webpack-бандл; при повторном бандлинге
  // webpack-dev его внутренний рантайм падает (Object.defineProperty called on
  // non-object). Транспиляция обоих пакетов через Next устраняет конфликт.
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // Роут переименован из upload_achievement; старые ссылки и закладки живут дальше.
      {
        source: '/upload_achievement',
        destination: '/upload-achievement',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

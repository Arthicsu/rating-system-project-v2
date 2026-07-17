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
  async headers() {
    // Фолбэк на случай запуска без прокси; первичный источник security-заголовков —
    // nginx (app/nginx/security-headers.conf), значения скопированы оттуда.
    // CSP и X-Frame-Options отсюда НЕ отдаём: двойной CSP комбинируется
    // рестриктивно и может сломать приложение, когда nginx стоит впереди.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

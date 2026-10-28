// frontend/app/layout.tsx
import '@/app/globals.css';
import '@/styles/fontawesome-free-7.2.0-web/css/all.min.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import Header from '@/components/Header';
import Providers from '@/app/providers';
import { AuthProvider } from '@/context/AuthContext';
import { LOW_VISION_SCRIPT } from '@/lib/lowVision';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes ставит класс темы на <html> до гидрации - отсюда расхождение с серверной разметкой.
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Версия для слабовидящих применяется до первой отрисовки, без мигания обычного вида. */}
        <script dangerouslySetInnerHTML={{ __html: LOW_VISION_SCRIPT }} />
      </head>
      {/* Нижнее меню телефона с крупным шрифтом выше - отступ под ним тоже больше. */}
      <body className="bg-slate-100 dark:bg-slate-50 pb-16 sm:pb-0 low-vision:pb-28 sm:low-vision:pb-0 pr-(--scrollbar-gap)">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>
            <AuthProvider>
              <Header />
              {/* --surface задана только в тёмной теме; в светлой уведомление белое. */}
              <Toaster
                toastOptions={{
                  style: {
                    background: 'var(--surface, #fff)',
                    color: 'var(--color-slate-900)',
                    border: '1px solid var(--color-slate-200)',
                  },
                }}
              />
              {children}
            </AuthProvider>
          </Providers>
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}

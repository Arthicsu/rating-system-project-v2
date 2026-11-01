// frontend/app/layout.tsx
import '@/app/globals.css';
import '@/styles/fontawesome-free-7.2.0-web/css/all.min.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import MobileTabBar from '@/components/layout/MobileTabBar';
import SkipLink from '@/components/layout/SkipLink';
import Providers from '@/app/providers';
import { AuthProvider } from '@/context/AuthContext';
import { LOW_VISION_SCRIPT } from '@/lib/lowVision';
import { ThemeProvider } from 'next-themes';
import { Suspense } from 'react';
import NavigationProgress from '@/components/layout/NavigationProgress';
import AppToaster from '@/components/AppToaster';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes ставит класс темы на <html> до гидрации - отсюда расхождение с серверной разметкой.
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Версия для слабовидящих применяется до первой отрисовки, без мигания обычного вида. */}
        <script dangerouslySetInnerHTML={{ __html: LOW_VISION_SCRIPT }} />
      </head>
      {/* Нижнее меню телефона с крупным шрифтом выше - отступ под ним тоже больше. */}
      <body className="flex min-h-dvh flex-col bg-slate-50 pr-(--scrollbar-gap)">
        <SkipLink />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>
            <AuthProvider>
              <Header />
              {/* tabIndex: «К содержимому» переводит фокус сюда, следующий Tab - первый элемент страницы.
                  flex-col: короткая страница может встать по центру между шапкой и низом (my-auto). */}
              <main id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                {children}
              </main>
              <Footer />
              <MobileTabBar />
              <AppToaster />
            </AuthProvider>
          </Providers>
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}

// frontend/app/layout.tsx
import '@/styles/normalize.css';
// import '../styles/style.css';
import '@/app/globals.css';
import '@/styles/fontawesome-free-7.2.0-web/css/all.min.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import Header from '@/components/Header';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import '@/bones/registry';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
    {/* <ThemeProvider attribute="class" defaultTheme="system" enableSystem> */}
      <head>
      </head>
      <body className="bg-slate-100 pb-16 sm:pb-0">
        <AuthProvider> 
          <Header />
          <Toaster />
          {children}
        </AuthProvider>
        <CookieConsentBanner />
      </body>
    {/* </ThemeProvider> */}
    </html>
  );
}
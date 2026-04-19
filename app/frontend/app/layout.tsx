// frontend/app/layout.tsx
import '@/styles/normalize.css';
// import '../styles/style.css';
import '@/app/globals.css';
import '@/styles/fontawesome-free-7.2.0-web/css/all.min.css';
import Header from '@/components/Header.jsx';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import '@/bones/registry'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
      </head>
      <body>
        <AuthProvider> 
          <Header />
          <Toaster />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
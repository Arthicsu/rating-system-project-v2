// frontend/app/layout.tsx
import '@/styles/normalize.css';
// import '../styles/style.css';
import '@/globals.css';
import Header from '@/components/Header.jsx';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { Skeleton } from 'boneyard-js/react'
import '@/bones/registry'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" 
        />
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
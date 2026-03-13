// frontend/app/layout.tsx
import '../styles/normalize.css';
import '../styles/style.css';
import './globals.css';
import Header from '../components/Header.jsx';
import { AuthProvider } from '../context/AuthContext';

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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
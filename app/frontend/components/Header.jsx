'use client';

import Link from 'next/link';
import { useMySession } from '@/context/AuthContext';

export default function Header() {
  const { logoutUser, user } = useMySession();
  
  return (
    <header className="header">
      <div className="container">
        <div className="header-wrapper">
          <div className="header-logo">
            <Link href="/">
              <img src="/media/logo_BGITU.png" alt="БГИТУ" className="header-img" />
            </Link>
            <div className="breadcrumbs">
              <Link href="/" className="header-link">Главная</Link>
              <span className="breadcrumbs__split">/</span>
            </div>
          </div>
          <div className="header-content">
            <a href="#">
              <img src="/media/logo_IT.png" alt="IT" className="header-img_it" />
            </a>
            <div className="header-content__item">
              {user ? (
                <>
                  <Link href={`/profile`} className="header-link__item">
                    {user.full_name}
                  </Link>
                  <button onClick={logoutUser} className="header-link__item" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    Выйти
                  </button>
                </>
                ) : (
                <Link href="/login" className="header-link__item">
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
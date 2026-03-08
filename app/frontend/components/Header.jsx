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
            <div
              className="header-content__item"
              style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
            >
              {user ? (
                <>
                  <Link
                    href={`/profile`}
                    className="header-link__item"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{user.full_name}</span>
                    <span
                      className="badge-count"
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#E11D48',
                        display: 'inline-block',
                      }}
                    />
                  </Link>
                  <button
                    onClick={logoutUser}
                    className="header-link__item"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
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
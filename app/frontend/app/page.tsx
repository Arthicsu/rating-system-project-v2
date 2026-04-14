'use client';

import Link from 'next/link';
import Login from '@/components/Login';
import { useMySession } from '@/context/AuthContext';
import RatingPage from '@/app/rating/page';

export default function Main() {
  const { loading, user } = useMySession();

  if (loading) {
      return (
        <div className="loader-container">
          <p>Загрузка сессии...</p>
        </div>
      );
    }

  const isAuth = user?.isAuthenticated == true;  
  return (
    <>
      {isAuth ? (
          <RatingPage/>
      ):(
          <Login/>
      )}
    </>
  );
}
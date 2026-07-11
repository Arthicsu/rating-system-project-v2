import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Защита приватных роутов на уровне сервера Next: аноним не получает даже HTML
 * приватной страницы (нет «мигания» контента до клиентского редиректа).
 *
 * ОГРАНИЧЕНИЕ (осознанное): проверяется только НАЛИЧИЕ сессионной куки -
 * её валидность и роль пользователя знает только backend (сессии в Redis).
 * Настоящая авторизация - permissions DRF на каждой ручке; протухшая кука
 * даст 401/403 от API, которые обрабатывает клиент.
 *
 * Имя куки - Django default 'sessionid' (SESSION_COOKIE_NAME в
 * backend/settings.py не переопределён; при смене имени обновить и здесь).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has('sessionid')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/staff-profile/:path*',
    '/upload_achievement/:path*',
    '/achievement/:path*',
    '/rating/:path*',
  ],
};

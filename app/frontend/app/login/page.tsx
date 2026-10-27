'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useMySession } from '@/context/AuthContext';
import PasswordInput from '@/components/forms/PasswordInput';
import { loginSchema, type LoginFormValues } from '@/lib/validation/auth';
import type ApiError from '@/interfaces/GeneralInterfaces';


// Возврат туда, откуда увело на логин (?next= ставят proxy.ts и 401-интерсептор
// axios). Принимаем только внутренние пути: внешний URL в next был бы open redirect.
// window.location вместо useSearchParams, чтобы не оборачивать страницу в Suspense.
function getNextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const { loginUser, user } = useMySession();
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);
  // Ошибка входа - рядом с формой, а не исчезающим тостом: она не пропадает, пока пользователь исправляет поля
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    // Маркер протухшей сессии от интерсептора axios: тост не пережил бы полную
    // навигацию, а плашка на самой странице к тому же не исчезнет через пару
    // секунд, пока пользователь тянется к полям формы. Query читаем в эффекте:
    // на сервере window нет, а useSearchParams навязал бы Suspense-обёртку.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionExpired(new URLSearchParams(window.location.search).get('expired') === '1');
  }, []);

  useEffect(() => {
    if (user && !isSubmitting) {
      router.push(getNextPath());
    }
  }, [user, isSubmitting, router]);

  if (user) return null;

  const onSubmit = async (data: LoginFormValues) => {
    setFormError(null);
    try {
      await loginUser(data);
      router.push(getNextPath());
    } catch (err) {
      const errorData = (err as ApiError).response?.data;
      setFormError(
        errorData?.detail ? String(errorData.detail) : 'Не удалось войти. Повторите попытку позже.'
      );
    }
  };

  return (
    <section className="min-h-screen bg-slate-100 px-4 pt-35 pb-10">
      <div className="mx-auto flex max-w-275 flex-col gap-8">
        {/* Форма авторизации */}
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-8 shadow-md md:px-10">
          <h1 className="mb-6 text-2xl font-semibold text-black text-center sm:text-3xl">
            Авторизация
          </h1>

          {sessionExpired && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Сессия истекла, войдите снова.
            </p>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm font-medium text-slate-600">
                Логин (для обучающихся E-Mail)
              </label>
              <input
                type="text"
                id="username"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                {...register('username')}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-600">
                Пароль
              </label>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                {...register('password')}
              />
            </div>

            {formError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer mt-2 w-full rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            {/* <Link className="text-sky-700 hover:text-sky-900 underline underline-offset-2" href="/register">
              Зарегистрироваться
            </Link> */}
            {/* <span className="h-5 w-px bg-slate-300" /> */}
            {/* Обе ссылки ведут на одну форму "пароль на почту" */}
            <p className="flex flex-wrap items-center justify-center gap-3">
              <Link
                className="inline-block py-1 font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900"
                href="/reset-password?mode=register"
              >
                Регистрация
              </Link>
              <span className="h-5 w-px bg-slate-300" aria-hidden="true" />
              <Link
                className="inline-block py-1 font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900"
                href="/reset-password"
              >
                Восстановить пароль
              </Link>
            </p>
          </div>
        </div>

        {/* Информационный блок справа */}
        <div className="flex w-full flex-col items-center justify-between gap-4 text-center">
          <p className="text-sm text-black md:text-base">
            Если у Вас возникли технические сложности, свяжитесь с нами по email:{' '}
            <Link
              href="mailto:oi@bgitu.ru"
              className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
            >
              oi@bgitu.ru
            </Link>
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs content-center font-medium text-sky-700 md:text-sm md:text-right md:self-stretch">
              BRYANSK STATE <br />
              TECHNOLOGICAL UNIVERSITY <br />
              OF ENGINEERING
            </p>
            <Image
              src="/media/logo_BGITU.svg"
              alt="Логотип БГИТУ"
              width={80}
              height={64}
              className="h-16 w-auto object-contain md:h-20"
            />
            <p className="text-xs content-center font-medium text-sky-700 md:text-sm md:text-left md:self-stretch">
              БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
              ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
              УНИВЕРСИТЕТ
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
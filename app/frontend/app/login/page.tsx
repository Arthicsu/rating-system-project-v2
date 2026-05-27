'use client';

import { useState, ChangeEvent, SubmitEvent, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { useMySession } from '@/context/AuthContext';
import type LoginFormData from '@/interfaces/LoginInterfaces';
import type ApiError from '@/interfaces/GeneralInterfaces';


export default function LoginPage() {
  const { loginUser, user } = useMySession();
  const router = useRouter();
  
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (user) return null;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await loginUser(formData);
      router.push('/');
    } catch (err) {
      const error = err as Error | ApiError;
            
      const errorData = (error as ApiError).response?.data;
      
      if (errorData?.message) {
        toast.error(String(errorData.message));
      } else {
        toast.error('Ошибка авторизации. Повторите попытку позже.');
      }
    } finally {
      setIsLoading(false);
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm font-medium text-slate-600">
                Логин (для обучающихся E-Mail)
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0069a8] focus:ring-1 focus:ring-[#0069a8]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-600">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none focus:border-[#0069a8] focus:ring-1 focus:ring-[#0069a8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer mt-2 w-full rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-[#0069a8]">
            <Link className="text-[#0069a8] hover:text-sky-900 underline underline-offset-2" href="/register">
              Зарегистрироваться
            </Link>
            {/* <span className="h-5 w-px bg-slate-300" /> */}
            {/* пока коммитим */}
            {/* <Link className="text-sky-700 hover:text-sky-900 underline underline-offset-2" href="/reset-password">
              Восстановить пароль
            </Link> */}
          </p>
        </div>

        {/* Информационный блок справа */}
        <div className="flex w-full flex-col items-center justify-between gap-4 text-center">
          <p className="text-sm text-black md:text-base">
            Если у Вас возникли технические сложности, свяжитесь с нами по email:{' '}
            <Link
              href="mailto:oi@bgitu.ru"
              className="font-semibold text-[#0069a8] underline underline-offset-2 hover:text-[#002D6E]"
            >
              oi@bgitu.ru
            </Link>
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs content-center font-medium text-[#0069a8] md:text-sm md:text-right md:self-stretch">
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
            <p className="text-xs content-center font-medium text-[#0069a8] md:text-sm md:text-left md:self-stretch">
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
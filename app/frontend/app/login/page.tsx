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
    <section className="min-h-screen bg-[#EDEFF3] px-4 pt-35 pb-10">
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
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-600">
                Пароль
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-md bg-[#0050CF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#002D6E] disabled:cursor-not-allowed disabled:bg-[#6B7A99]"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-[#6a7a98]">
            <Link className="text-[#0050CF] hover:text-[#002D6E] underline underline-offset-2" href="/register">
              Зарегистрироваться
            </Link>
            <span className="h-5 w-px bg-slate-300" />
            <Link className="text-sky-700 hover:text-sky-900 underline underline-offset-2" href="/reset-password">
              Восстановить пароль
            </Link>
          </p>
        </div>

        {/* Информационный блок справа */}
        <div className="flex w-full flex-col items-center justify-between gap-4 text-center">
          <p className="text-sm text-black md:text-base">
            Если у Вас возникли технические сложности, свяжитесь с нами по email:{' '}
            <Link
              href="mailto:oi@bgitu.ru"
              className="font-semibold text-[#0050CF] underline underline-offset-2 hover:text-[#002D6E]"
            >
              oi@bgitu.ru
            </Link>
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs content-center font-medium text-[#0050CF] md:text-sm md:text-right md:self-stretch">
              BRYANSK STATE <br />
              TECHNOLOGICAL UNIVERSITY <br />
              OF ENGINEERING
            </p>
            <Image
              src="/media/logo_BGITU.png"
              alt="Логотип БГИТУ"
              width={80}
              height={64}
              className="h-16 w-auto object-contain md:h-20"
            />
            <p className="text-xs content-center font-medium text-[#0050CF] md:text-sm md:text-left md:self-stretch">
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
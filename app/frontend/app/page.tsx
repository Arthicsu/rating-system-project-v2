'use client';

import { useMySession } from '@/context/AuthContext';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function Main() {
  const { loading, user } = useMySession();
  if (loading) {
      return (
        <div className="loader-container">
          <p>Загрузка сессии...</p>
        </div>
      );
    }
    
  if (user?.isAuthenticated === true) {redirect("/rating")}
  return (
    <section className="min-h-screen bg-slate-100 px-4 pt-30 pb-10">
      <div className="mx-auto flex max-w-300 flex-col gap-6 rounded-2xl bg-white/90 p-6 shadow-sm items-center lg:flex-row md:gap-8 md:px-10 md:py-8">
        {/* Левая колонка с описанием */}
        <div className="flex-1 space-y-4">
          <p className="text-xl bold font-semibold text-black sm:text-2xl md:text-3xl">
            Авторизация пользователя
          </p>

          <div className="flex items-center gap-4 pb-4 md:gap-6">
            <Image
              src="/media/logo_BGITU.svg"
              alt="БГИТУ"
              width={80}
              height={80}
              className="h-20 w-auto object-contain md:h-24"
            />
            <p className="text-xs font-semibold text-[#0050CF] md:text-base sm:text-sm">
              БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
              ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
              УНИВЕРСИТЕТ — ВЫСШЕЕ УЧЕБНОЕ <br />
              ЗАВЕДЕНИЕ БРЯНСКА.
            </p>
          </div>

          <p className="text-xs text-[#333] md:text-base sm:text-sm">
            «Портфолио БГИТУ» - система для автоматизации учёта достижений студентов. <br />
            Данный сайт представляет собой Web-расширение информационной системы БГИТУ, <br />
            созданное для студентов и сотрудников университета.
          </p>
          {/* <p className="text-xs text-[#333] md:text-base sm:text-sm">
            email:{' '}
            <Link
              className="text-[#0050CF] underline underline-offset-2 hover:text-[#002D6E]"
              href="mailto:oi@bgitu.ru"
            >
              oi@bgitu.ru
            </Link>
          </p> */}
        </div>

        {/* Правая колонка с действиями */}
        <div className="flex w-full max-w-xs flex-col items-stretch justify-center gap-3 rounded-2xl bg-[#F5F7FB] px-5 py-6 shadow-sm md:max-w-sm">
          <button className="cursor-pointer w-full rounded-md bg-sky-700 text-sm font-semibold text-white transition hover:bg-sky-900">
            <Link href="/register" className="block w-full text-center px-4 py-3">
              Зарегистрироваться
            </Link>
          </button>

          <button className="cursor-pointer w-full rounded-md bg-white text-sm font-semibold text-[#0069a8] ring-1 ring-[#0069a8] transition hover:bg-sky-700 hover:text-white">
            <Link href="/login" className="block w-full text-center px-4 py-3">
              Войти
            </Link>
          </button>

          {/* <button className="cursor-pointer mt-1 text-center text-xs text-[#6a7a98] underline underline-offset-2 hover:text-[#0069a8]">
            <Link href="/reset-password">
              Восстановить пароль
            </Link>
          </button> */}
        </div>
      </div>
    </section>
  );
}
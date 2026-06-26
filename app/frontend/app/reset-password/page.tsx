'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useMySession } from '@/context/AuthContext';

export default function ResetPasswordPage() {
  const { user } = useMySession();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  if (user) return null;

  return (
    <section className="min-h-screen bg-slate-100 px-4 pt-35 pb-10">
      <div className="mx-auto flex max-w-275 flex-col gap-8">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-8 shadow-md md:px-10">
          <h1 className="mb-6 text-2xl font-semibold text-black text-center sm:text-3xl">
            Восстановление пароля
          </h1>

          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              Временно недоступно
            </div>
            <p>
              Функция восстановления пароля на данный момент недоступна.<br></br> Для решения проблем со входом обратитесь в отдел информатизации:{' '}
              <Link
                href="mailto:oi@bgitu.ru"
                className="font-semibold text-[#0050CF] underline underline-offset-2 hover:text-[#002D6E]"
              >
                oi@bgitu.ru
              </Link>
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className="rounded-md bg-sky-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-900"
            >
              Вернуться ко входу
            </Link>
          </div>
        </div>

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
              src="/media/logo_BGITU.svg"
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
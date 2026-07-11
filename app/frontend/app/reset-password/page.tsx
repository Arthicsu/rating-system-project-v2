'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useMySession } from '@/context/AuthContext';
import { authApi } from '@/lib/apiRequests';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/validation/auth';
import type ApiError from '@/interfaces/GeneralInterfaces';

export default function ResetPasswordPage() {
  const { user } = useMySession();
  const router = useRouter();

  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  if (user) return null;

  const onSubmit = async ({ email }: ResetPasswordFormValues) => {
    try {
      const { data } = await authApi.forgotPassword({ email });
      setSentEmail(email);
      toast.success(data?.message ?? 'Новый пароль отправлен на почту');
    } catch (err) {
      const error = err as Error | ApiError;
      const errorData = (error as ApiError).response?.data;

      if (errorData?.detail) {
        toast.error(String(errorData.detail));
      } else {
        toast.error('Не удалось отправить письмо. Повторите попытку позже.');
      }
    }
  };

  return (
    <section className="min-h-screen bg-slate-100 px-4 pt-35 pb-10">
      <div className="mx-auto flex max-w-275 flex-col gap-8">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-8 shadow-md md:px-10">
          <h1 className="mb-6 text-2xl font-semibold text-black text-center sm:text-3xl">
            Восстановление пароля
          </h1>

          {sentEmail ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              <p>
                Если аккаунт с почтой <span className="font-semibold">{sentEmail}</span> существует,
                на него отправлено письмо с новый пароль. Проверьте почту (в том числе
                папку «Спам») и войдите с новым паролем.
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <p className="text-sm text-slate-600">
                Укажите email, привязанный к вашему аккаунту. Мы отправим на него новый временный пароль.
              </p>

              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-slate-600">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="you@bgitu.ru"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0069a8] focus:ring-1 focus:ring-[#0069a8]"
                  {...register('email')}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer mt-2 w-full rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? 'Отправка...' : 'Отправить новый пароль'}
              </button>
            </form>
          )}

          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className="cursor-pointer mt-1 text-center text-xs text-sky-700 underline underline-offset-2 hover:text-sky-800"
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

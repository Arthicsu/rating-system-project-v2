'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import PageContainer from '@/components/layout/PageContainer';
import { useMySession } from '@/context/AuthContext';
import { authApi } from '@/lib/apiRequests';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/validation/auth';
import type ApiError from '@/interfaces/GeneralInterfaces';

// Один сценарий "пароль на email" на две операции:
// "Регистрация" - первый пароль для аккаунта, созданного импортом,
// "Восстановление" - новый пароль вместо забытого.
const COPY = {
  register: {
    title: 'Регистрация',
    intro: 'На основе ЭОС уже создан студенческий аккаунт - осталось получить пароль для первого входа.',
    submit: 'Получить пароль',
  },
  reset: {
    title: 'Восстановление пароля',
    intro: 'Пришлём письмо с новым паролем, старый перестанет действовать.',
    submit: 'Получить новый пароль',
  },
} as const;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const { user } = useMySession();
  const router = useRouter();
  const copy = useSearchParams().get('mode') === 'register' ? COPY.register : COPY.reset;

  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
    try {
      await authApi.forgotPassword({ email });
      setSentEmail(email);
    } catch (err) {
      const error = err as Error | ApiError;
      const errorData = (error as ApiError).response?.data;

      setFormError(
        errorData?.detail ? String(errorData.detail) : 'Не удалось отправить письмо. Повторите попытку позже.'
      );
    }
  };

  return (
    <PageContainer width="auth">
      <div className="rounded-2xl bg-white px-6 py-8 shadow-md md:px-10">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900 text-center sm:text-3xl">
          {copy.title}
        </h1>

        {sentEmail ? (
          <div role="status" className="space-y-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>
              Если студенческий аккаунт с почтой <span className="font-semibold break-all">{sentEmail}</span>{' '}
              существует, на неё отправлено письмо с паролем для входа.
            </p>
            <p>
              Проверьте почту, в том числе папку «Спам». Если письмо не пришло, запросить его
              повторно можно через 15 минут.
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <p className="text-sm text-slate-600">
              {copy.intro} <br />
              Укажите E-mail от учётной записи ЭОС (E-mail должен быть внесён в личное дело).
            </p>

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-600">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="Введите E-mail"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                {...register('email')}
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
              {isSubmitting ? 'Отправка...' : copy.submit}
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
    </PageContainer>
  );
}

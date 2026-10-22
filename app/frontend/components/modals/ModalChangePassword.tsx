'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import ModalShell from './ModalShell';
import PasswordInput from '@/components/forms/PasswordInput';
import { authApi } from '@/lib/apiRequests';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/lib/validation/auth';
import type { ModalChangePasswordProps } from '@/interfaces/ModalInterfaces';

type FieldName = keyof ChangePasswordFormValues;

const FIELDS: { name: FieldName; label: string; autoComplete: string; hint?: string }[] = [
  { name: 'oldPassword', label: 'Текущий пароль', autoComplete: 'current-password' },
  {
    name: 'newPassword',
    label: 'Новый пароль',
    autoComplete: 'new-password',
    hint: 'Не короче 8 символов, не только из цифр и не похожий на вашу почту.',
  },
  { name: 'newPasswordConfirm', label: 'Повторите новый пароль', autoComplete: 'new-password' },
];

// Ошибки сервера приходят под именами полей API - ставим их под свои поля формы.
const SERVER_FIELDS: Record<string, FieldName> = {
  old_password: 'oldPassword',
  new_password: 'newPassword',
};

const INPUT_CLASS =
  'h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-11 text-sm text-slate-900 outline-none focus:border-[#0069a8] focus:ring-1 focus:ring-[#0069a8] aria-[invalid=true]:border-rose-400';

/**
 * Смена пароля студентом: текущий, новый и повтор. Остальные сессии студента
 * сервер завершает сам, текущая остаётся; на почту уходит уведомление.
 */
export default function ModalChangePassword({ isOpen, onClose }: ModalChangePasswordProps) {
  const [formError, setFormError] = useState<string | null>(null);
  // После успеха кнопка остаётся выключенной на время закрытия: Enter в поле
  // отправил бы старый пароль ещё раз (400 и потраченная попытка лимита).
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: '', newPassword: '', newPasswordConfirm: '' },
  });

  const submitWith = (close: () => void) => async (values: ChangePasswordFormValues) => {
    setFormError(null);
    try {
      await authApi.changePassword({ old_password: values.oldPassword, new_password: values.newPassword });
      setDone(true);
      toast.success('Пароль изменён. На почту отправлено уведомление.');
      close();
    } catch (err) {
      const data = (err as AxiosError<Record<string, string[] | string>>).response?.data;
      let placed = false;
      for (const [apiField, field] of Object.entries(SERVER_FIELDS)) {
        const messages = data?.[apiField];
        if (Array.isArray(messages) && messages.length > 0) {
          setError(field, { message: messages.join(' ') }, { shouldFocus: !placed });
          placed = true;
        }
      }
      if (!placed) {
        // 429 (с временем ожидания), обрыв сети и прочее - общим сообщением над кнопками.
        setFormError(
          typeof data?.detail === 'string' ? data.detail : 'Не удалось сменить пароль. Повторите попытку позже.'
        );
      }
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      locked={isSubmitting}
      closeButton
      labelledBy="change-password-title"
      onClosed={() => {
        reset();
        setFormError(null);
        setDone(false);
      }}
    >
      {(close) => (
        <form className="space-y-4" noValidate onSubmit={handleSubmit(submitWith(close))}>
          <h2 id="change-password-title" className="pr-8 text-base font-semibold text-slate-900">
            Смена пароля
          </h2>

          {FIELDS.map(({ name, label, autoComplete, hint }, index) => {
            const id = `change-password-${name}`;
            const error = errors[name]?.message;
            return (
              <div key={name} className="space-y-1">
                <label htmlFor={id} className="text-sm font-medium text-slate-600">
                  {label}
                </label>
                <PasswordInput
                  id={id}
                  autoComplete={autoComplete}
                  // Диалог открывается ради ввода - фокус сразу в первое поле.
                  autoFocus={index === 0}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
                  className={INPUT_CLASS}
                  {...register(name)}
                />
                {error ? (
                  // role=alert: фокус ставится раньше перерисовки, и без озвучки ошибку не услышать.
                  <p id={`${id}-error`} role="alert" className="text-xs text-rose-600">
                    {error}
                  </p>
                ) : (
                  hint && (
                    <p id={`${id}-hint`} className="text-xs text-slate-500">
                      {hint}
                    </p>
                  )
                )}
              </div>
            );
          })}

          {formError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || done}
              className="cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Сохранение…' : 'Сменить пароль'}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={close}
              className="cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

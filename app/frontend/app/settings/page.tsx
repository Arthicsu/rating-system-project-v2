'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import ModalChangePassword from '@/components/modals/ModalChangePassword';
import { useMySession } from '@/context/AuthContext';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { apiErrorMessage, isAuthError } from '@/lib/apiError';
import { authApi } from '@/lib/apiRequests';

const SECTION = 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5';

/** Настройки вошедшего пользователя. Студент меняет здесь пароль и письма; сотрудник пароль не меняет. */
export default function SettingsPage() {
  const { user, setUser } = useMySession();
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);
  useRedirectIfLoggedOut('/settings');

  const isStudent = !!user?.roles?.includes('Student') && !user.is_employee;
  const emailsOn = !!user?.notify_review_emails;

  const toggleEmails = async () => {
    if (!user || savingEmails) return;
    setSavingEmails(true);
    try {
      const { data } = await authApi.updateNotifications({ notify_review_emails: !emailsOn });
      setUser({ ...user, notify_review_emails: data.notify_review_emails });
      toast.success(data.notify_review_emails ? 'Письма о решениях включены' : 'Письма о решениях отключены');
    } catch (error) {
      // 401/403 и 429 уже обработал интерсептор axios.
      if (!isAuthError(error) && (error as AxiosError).response?.status !== 429) {
        toast.error(apiErrorMessage(error, 'Не удалось сохранить настройку'));
      }
    } finally {
      setSavingEmails(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pt-24 pb-10">
      <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-5">
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">Настройки</h1>

        <section aria-labelledby="settings-account" className={SECTION}>
          <h2 id="settings-account" className="text-base font-semibold text-slate-900">
            Аккаунт
          </h2>
          {!user ? (
            <div className="mt-3 h-11 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">Пароль</p>
                <p className="text-sm text-slate-500">
                  {isStudent
                    ? 'После смены пароля вход на других устройствах завершится.'
                    : 'Пароль сотрудника выдаёт отдел информатизации.'}
                </p>
              </div>
              {isStudent && (
                <button
                  type="button"
                  onClick={() => setChangingPassword(true)}
                  className="cursor-pointer inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:min-h-9"
                >
                  <i className="fa-solid fa-lock" aria-hidden="true" />
                  Сменить пароль
                </button>
              )}
            </div>
          )}
        </section>

        {isStudent && (
          <section aria-labelledby="settings-notifications" className={SECTION}>
            <h2 id="settings-notifications" className="text-base font-semibold text-slate-900">
              Уведомления
            </h2>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p id="notify-review-label" className="text-sm font-medium text-slate-800">
                  Письма о решениях по заявкам
                </p>
                <p id="notify-review-hint" className="text-sm text-slate-500">
                  Одобрение, отклонение с причиной и возврат на повторную проверку — на вашу почту.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailsOn}
                aria-labelledby="notify-review-label"
                aria-describedby="notify-review-hint"
                aria-disabled={savingEmails}
                onClick={toggleEmails}
                className="relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 aria-disabled:cursor-wait aria-disabled:opacity-60"
              >
                <span
                  className={`h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${emailsOn ? 'bg-sky-700' : 'bg-slate-500'}`}
                />
                <span
                  className={`absolute left-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${emailsOn ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>
          </section>
        )}
      </div>

      {isStudent && <ModalChangePassword isOpen={changingPassword} onClose={() => setChangingPassword(false)} />}
    </main>
  );
}

'use client';

import { useState } from 'react';

import ModalChangePassword from '@/components/modals/ModalChangePassword';
import { useMySession } from '@/context/AuthContext';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';

/** Настройки вошедшего пользователя. Студент меняет здесь пароль; сотрудник пароль не меняет. */
export default function SettingsPage() {
  const { user } = useMySession();
  const [changingPassword, setChangingPassword] = useState(false);
  useRedirectIfLoggedOut('/settings');

  return (
    <main className="min-h-screen bg-slate-50 pt-24 pb-10">
      <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-5">
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">Настройки</h1>

        <section
          aria-labelledby="settings-account"
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
        >
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
                  {user.is_employee
                    ? 'Пароль сотрудника выдаёт отдел информатизации.'
                    : 'После смены пароля вход на других устройствах завершится.'}
                </p>
              </div>
              {!user.is_employee && (
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
      </div>

      {user && !user.is_employee && (
        <ModalChangePassword isOpen={changingPassword} onClose={() => setChangingPassword(false)} />
      )}
    </main>
  );
}

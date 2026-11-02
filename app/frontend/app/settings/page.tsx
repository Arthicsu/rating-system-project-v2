'use client';

import { useState } from 'react';
import toast from '@/lib/toast';
import type { AxiosError } from 'axios';

import Button from '@/components/Button';
import Card, { CARD_TITLE } from '@/components/Card';
import ModalChangePassword from '@/components/modals/ModalChangePassword';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Bone, BoneLine, BUTTON_BONE, SkeletonScreen } from '@/components/Skeleton';
import LowVisionSettings from '@/components/LowVisionSettings';
import Switch from '@/components/Switch';
import ThemeToggle from '@/components/ThemeToggle';
import { useMySession } from '@/context/AuthContext';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { apiErrorMessage, isAuthError } from '@/lib/apiError';
import { authApi } from '@/lib/apiRequests';

/** Настройки вошедшего пользователя. Студент меняет здесь пароль и письма; сотрудник пароль не меняет; тема - у всех. */
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
    <>
      <PageContainer width="narrow">
        <PageHeader title="Настройки" />

        <div className="space-y-4">
          <Card as="section" aria-labelledby="settings-account">
            <h2 id="settings-account" className={CARD_TITLE}>
              Аккаунт
            </h2>
            {!user ? (
              <SkeletonScreen className="mt-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5 text-sm">
                    <BoneLine className="w-20" />
                    <BoneLine className="w-96 max-w-full" />
                    <BoneLine className="hidden w-40 max-sm:block" />
                  </div>
                  <Bone className={`${BUTTON_BONE.sm} w-44 shrink-0`} />
                </div>
              </SkeletonScreen>
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
                  <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setChangingPassword(true)}>
                    <i className="fa-solid fa-lock" aria-hidden="true" />
                    Сменить пароль
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Раздел есть у студента; пока сессия грузится, место под него держит скелетон. */}
          {!user && (
            <SkeletonScreen>
              <Card>
                <BoneLine className="w-32 text-base" />
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 text-sm">
                    <BoneLine className="w-60 max-w-full" />
                    <BoneLine className="w-96 max-w-full" />
                    <BoneLine className="hidden w-48 max-sm:block" />
                  </div>
                  <span className="flex h-11 w-14 shrink-0 items-center justify-center">
                    <Bone className="h-6 w-11 rounded-full" />
                  </span>
                </div>
              </Card>
            </SkeletonScreen>
          )}

          {isStudent && (
            <Card as="section" aria-labelledby="settings-notifications">
              <h2 id="settings-notifications" className={CARD_TITLE}>
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
                <Switch
                  checked={emailsOn}
                  onToggle={toggleEmails}
                  labelledBy="notify-review-label"
                  describedBy="notify-review-hint"
                  busy={savingEmails}
                />
              </div>
            </Card>
          )}

          <Card as="section" aria-labelledby="settings-appearance">
            <h2 id="settings-appearance" className={CARD_TITLE}>
              Оформление
            </h2>
            <div className="mt-3 space-y-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">Тема</p>
                <p className="text-sm text-slate-500">
                  «Как в системе» следует настройке устройства. Выбор запоминается в этом браузере.
                </p>
              </div>
              <ThemeToggle />
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <LowVisionSettings />
            </div>
          </Card>
        </div>
      </PageContainer>

      {isStudent && <ModalChangePassword isOpen={changingPassword} onClose={() => setChangingPassword(false)} />}
    </>
  );
}

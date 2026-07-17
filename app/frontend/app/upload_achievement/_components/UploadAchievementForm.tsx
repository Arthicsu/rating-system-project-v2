'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Skeleton } from 'boneyard-js/react';
import { AxiosError } from 'axios';

import FileDropZone from '@/components/upload/FileDropZone';
import CustomSelect from '@/components/CustomSelect';
import { useAchievementConfig } from '@/hooks/queries/useAchievementConfig';
import { useUploadAchievement } from '@/hooks/mutations/useAchievementMutations';
import { apiErrorMessage } from '@/lib/apiError';
import {
  uploadAchievementSchema,
  type UploadAchievementValues,
  type UploadAchievementSubmit,
} from '@/lib/validation/achievement';
import type { AuthUser } from '@/interfaces/AuthInterfaces';
import type { DataStructure } from '@/interfaces/AchievementInterfaces';

const EMPTY_STRUCTURE: DataStructure = {};

/** Подпись ошибки под полем; ничего не рендерит, пока поле валидно. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-600">{message}</p>;
}

/**
 * Форма загрузки достижения: react-hook-form + zod (uploadAchievementSchema).
 * Ошибки валидации показываются под полями.
 */
export default function UploadAchievementForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const uploadMutation = useUploadAchievement();
  // Ключ идемпотентности живёт на уровне попытки отправки, а не HTTP-запроса:
  // повтор после сетевого сбоя идёт с тем же ключом и сервер отвечает 409
  // вместо создания дубля. Новый ключ - после успеха или подтверждённого 409.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const { data: config, error: configError, isPending: configLoading } = useAchievementConfig();
  useEffect(() => {
    if (configError) toast.error("Ошибка: " + configError);
  }, [configError]);

  const dataStructure = config?.structure ?? EMPTY_STRUCTURE;
  const levelsList = config?.levels ?? [];
  const resultsList = config?.results ?? [];
  const docTypesList = config?.doc_types ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<UploadAchievementValues, unknown, UploadAchievementSubmit>({
    resolver: zodResolver(uploadAchievementSchema),
    defaultValues: {
      category: null,
      subType: null,
      level: null,
      result: null,
      docType: null,
      achievement: '',
      dateReceived: '',
      files: [],
    },
  });

  const category = watch('category');
  const subType = watch('subType');
  const level = watch('level');
  const result = watch('result');
  const docType = watch('docType');
  const achievementName = watch('achievement');
  const files = watch('files');

  // FileDropZone ждёт setState-совместимый сеттер (использует в т.ч.
  // функциональный апдейт при удалении файла из списка).
  const setFiles: React.Dispatch<React.SetStateAction<File[]>> = (action) =>
    setValue('files', typeof action === 'function' ? action(getValues('files')) : action, {
      shouldValidate: true,
    });

  const getFilteredResults = () => {
    if (!subType) return resultsList;

    const allowed = subType.allowedResults;
    if (!allowed || allowed.length === 0) return resultsList;

    return resultsList.filter((item) => allowed.includes(item.code));
  };

  const getFilteredLevels = () => {
    if (!subType) return levelsList;

    const allowed = subType.allowedLevels;
    if (!allowed || allowed.length === 0) return levelsList;

    return levelsList.filter((item) => allowed.includes(item.code));
  };

  const getCurrentScore = (): number | null => {
    if (!subType || !subType.scoring_rules) return null;

    const rule = subType.scoring_rules.find((r) => {
      const levelMatch = subType.needsLevel ? r.level === level?.code : r.level === null;
      const resultMatch = subType.needsResult ? r.result === result?.code : r.result === null;
      return levelMatch && resultMatch;
    });

    return rule?.score ?? null;
  };

  const onSubmit = async (values: UploadAchievementSubmit) => {
    if (!user.record_book) {
      toast.error('В профиле не указан номер зачётной книжки');
      return;
    }

    const formData = new FormData();
    formData.append('record_book', user.record_book);
    formData.append('category', values.category);
    formData.append('sub_type', values.subType.code);
    formData.append('achievement', values.achievement);
    formData.append('date_received', values.dateReceived);
    formData.append('doc_type', values.docType.code);

    if (values.subType.needsLevel && values.level) formData.append('level', values.level.code);
    if (values.subType.needsResult && values.result) formData.append('result', values.result.code);

    values.files.forEach((f) => formData.append('files', f));

    const loadingToast = toast.loading('Загрузка достижения...');

    try {
      // Инвалидация кэша (профиль, дашборд, счётчик заявок) живёт в самом хуке.
      const response = await uploadMutation.mutateAsync({
        formData,
        idempotencyKey: idempotencyKeyRef.current,
      });
      toast.dismiss(loadingToast);
      toast.success(response.message);
      idempotencyKeyRef.current = crypto.randomUUID();
      router.push('/profile');
    } catch (error) {
      toast.dismiss(loadingToast);
      const err = error as AxiosError;
      if (err.response?.status === 409) {
        // Сервер уже принял эту отправку (клиент в прошлый раз не дождался
        // ответа) - ведём себя как при успехе, дубля не будет.
        toast.success('Это достижение уже отправлено');
        idempotencyKeyRef.current = crypto.randomUUID();
        router.push('/profile');
      } else if (err.code === 'ECONNABORTED') {
        toast.error('Время ожидания ответа от сервера истекло. Проверьте размер файлов и попробуйте снова.');
      } else {
        const msg = apiErrorMessage(error, '');
        toast.error(msg ? 'Ошибка: ' + msg : 'Ошибка при отправке достижения');
      }
    }
  };

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4 sm:items-stretch sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
            Загрузка достижения для ПГАС
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Опишите достижение: укажите параметры достижения и прикрепите
            подтверждающий(-ие) документ(-ы).
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 sm:px-5 sm:min-w-24">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Баллы
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 leading-tight">
            {getCurrentScore() ?? 0}
          </p>
        </div>
      </div>
      {/* Пока конфиг достижений грузится, поверх формы рисуются кости.
          Скрытая форма с пустыми списками задает высоту контейнера. */}
      <Skeleton name="upload-form-fields" loading={configLoading}>
        <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] sm:p-5">
          {/* Левая колонка: форма */}
          <div className="space-y-4">
          {/* Номер зачетной */}
          <div className="space-y-1.5">
            <label htmlFor="record-book" className="text-[11px] font-medium text-slate-500">
              Номер зачетной книги
            </label>
            <input
              id="record-book"
              className="w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition"
              type="text"
              value={user.record_book || ''}
              readOnly
            />
          </div>

          {/* Категория */}
          <CustomSelect
            label="Категория (обязательно)"
            value={category ?? ''}
            placeholder="Выберите категорию"
            options={Object.keys(dataStructure).map((key) => ({
              value: key,
              label: dataStructure[key].label,
            }))}
            onChange={(value) => {
              // Каскад: смена категории сбрасывает вид/уровень/результат.
              setValue('category', value, { shouldValidate: true });
              setValue('subType', null);
              setValue('level', null);
              setValue('result', null);
            }}
          />
          <FieldError message={errors.category?.message} />

          {/* Вид деятельности */}
          {category && (
            <>
              <CustomSelect
                label="Вид деятельности (обязательно)"
                value={subType?.code ?? ''}
                placeholder="Выберите вид деятельности"
                options={dataStructure[category].sub_types.map((item) => ({
                  value: item.code,
                  label: item.label,
                }))}
                onChange={(value) => {
                  const selected = dataStructure[category].sub_types.find((item) => item.code === value);
                  if (selected) {
                    setValue('subType', selected, { shouldValidate: true });
                    setValue('level', null);
                    setValue('result', null);
                  }
                }}
              />
              <FieldError message={errors.subType?.message} />
            </>
          )}

          {/* Уровень */}
          {subType?.needsLevel && (
            <>
              <CustomSelect
                label="Уровень мероприятия (обязательно)"
                value={level?.code ?? ''}
                placeholder="Выберите уровень"
                options={getFilteredLevels().map((item) => ({
                  value: item.code,
                  label: item.label,
                }))}
                onChange={(value) => {
                  const selected = getFilteredLevels().find((item) => item.code === value);
                  if (selected) {
                    setValue('level', selected, { shouldValidate: true });
                  }
                }}
              />
              <FieldError message={errors.level?.message} />
            </>
          )}

          {/* Результат */}
          {subType?.needsResult && (
            <>
              <CustomSelect
                label="Результат / Место (обязательно)"
                value={result?.code ?? ''}
                placeholder="Выберите результат"
                options={getFilteredResults().map((item) => ({
                  value: item.code,
                  label: item.label,
                }))}
                onChange={(value) => {
                  const selected = getFilteredResults().find((item) => item.code === value);
                  if (selected) {
                    setValue('result', selected, { shouldValidate: true });
                  }
                }}
              />
              <FieldError message={errors.result?.message} />
            </>
          )}

          {/* Тип документа */}
          <CustomSelect
            label="Тип документа (обязательно)"
            value={docType?.code ?? ''}
            placeholder="Выберите тип документа"
            options={docTypesList.map((item) => ({
              value: item.code,
              label: item.label,
            }))}
            onChange={(value) => {
              const selected = docTypesList.find((item) => item.code === value);
              if (selected) {
                setValue('docType', selected, { shouldValidate: true });
              }
            }}
          />
          <FieldError message={errors.docType?.message} />

          {/* Название достижения */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500">
              Название достижения (обязательно)
            </label>
            <div className="relative">
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600 resize-none"
                rows={2}
                maxLength={1000}
                placeholder="Название как в документе"
                {...register('achievement')}
              />
              <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                {achievementName.length}/1000
              </span>
            </div>
            <FieldError message={errors.achievement?.message} />
          </div>

          {/* Дата получения достижения */}
          <div className="space-y-1.5">
            <label htmlFor="date-received" className="text-[11px] font-medium text-slate-500">
              Дата получения достижения (обязательно)
            </label>
            <input
              id="date-received"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600"
              type="date"
              {...register('dateReceived')}
            />
            <FieldError message={errors.dateReceived?.message} />
          </div>

          {/* Файлы */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500">
              Файлы (обязательно)
            </label>
            <FileDropZone files={files} setFiles={setFiles} />
            <FieldError message={errors.files?.message} />
          </div>
        </div>

        {/* Правая колонка: кнопка + QR */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={uploadMutation.isPending}
                className="cursor-pointer inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(52,211,153,0.45)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 w-full sm:w-auto"
              >
                Загрузить
              </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                Актуальную разбалловку Вы можете узнать, перейдя по ссылке
                или отсканировав QR-код:
              </p>
              <Link
                href="https://clck.ru/3RRp3V"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-900"
              >
                clck.ru/3RRp3V
              </Link>
            </div>

            <div className="flex justify-center shrink-0">
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200">
                <Image
                  src="/media/frame.png"
                  alt="QR"
                  width={112}
                  height={112}
                  className="h-28 w-28 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </Skeleton>
    </>
  );
}

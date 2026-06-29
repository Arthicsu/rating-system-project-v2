'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { useMySession } from '@/context/AuthContext';
import { Skeleton } from 'boneyard-js/react';
import { useRouter } from 'next/navigation';
import FileDropZone from '@/components/upload/FileDropZone';
import CustomSelect from '@/components/CustomSelect';
import { studentApi } from '@/lib/apiRequests';
import type { SelectOption, DataStructure } from '@/interfaces/AchievementInterfaces';

export default function UploadAchievement() {
  const router = useRouter();
  const { user, loading: authLoading } = useMySession();

  const [dataStructure, setDataStructure] = useState<DataStructure>({});
  const [levelsList, setLevelsList] = useState<SelectOption[]>([]);
  const [resultsList, setResultsList] = useState<SelectOption[]>([]);
  const [docTypesList, setDocTypesList] = useState<SelectOption[]>([]);

  const [achievementName, setAchievementName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [subType, setSubType] = useState<SelectOption | null>(null);
  const [level, setLevel] = useState<SelectOption | null>(null);
  const [result, setResult] = useState<SelectOption | null>(null);
  const [docType, setDocType] = useState<SelectOption | null>(null);
  const [dateReceived, setDateReceived] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await studentApi.getAchievementConfig();
        const { structure, levels, results, doc_types } = response.data;
        setDataStructure(structure);
        setLevelsList(levels);
        setResultsList(results);
        setDocTypesList(doc_types);
      } catch (error) {
        toast.error("Ошибка: " + error);
      }
    };
    fetchConfig();
  }, []);

  if (authLoading) {
    return (
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <Skeleton name="upload-form" loading={false}>
            <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 animate-pulse">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="h-10 w-32 rounded-full bg-slate-200" />
              </div>
            </div>
          </Skeleton>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <p className="rounded-full bg-rose-50 px-4 py-2 text-sm text-rose-700">
          Нужно войти в систему
        </p>
      </div>
    );
  }

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const MAX_SIZE = 20 * 1024 * 1024;
    const selected = Array.from(e.target.files || []);
    const oversized = selected.filter(f => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`Файл(ы) превышают 20 МБ: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }
    const totalSize = selected.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_SIZE) {
      toast.error("Общий размер файлов превышает 20 МБ");
      return;
    }
    if (selected.length > 3) {
      toast.error("Максимальное количество файлов - 3");
      setFiles(selected.slice(0, 3));
    } else {
      setFiles(selected);
    }
  };

  const handleSubmit = async () => {
    if (!user?.record_book || !category || !subType || !achievementName || !docType || !dateReceived || files.length === 0) {
      toast.error("Пожалуйста, заполните все обязательные поля (категория, вид, тип документа, название, дата получения) и прикрепите файл(-ы) подтверждения достижения.");
      return;
    }

    if (subType.needsLevel && !level) {
      toast.error("Пожалуйста, выберите уровень мероприятия.");
      return;
    }

    if (subType.needsResult && !result) {
      toast.error("Пожалуйста, выберите результат / место.");
      return;
    }

    const formData = new FormData();
    formData.append('record_book', user.record_book);
    formData.append('category', category);
    formData.append('sub_type', subType.code);
    formData.append('achievement', achievementName);
    formData.append('date_received', dateReceived);

    if (docType) {
        formData.append('doc_type', docType.code);
    }

    if (subType.needsLevel && level) formData.append('level', level.code);
    if (subType.needsResult && result) formData.append('result', result.code);

    if (files.length) {
      files.forEach((f) => formData.append('files', f));
    }

    const loadingToast = toast.loading('Загрузка достижения...');

    try {
      const response = await studentApi.uploadAchievement(formData);
      toast.dismiss(loadingToast);
      toast.success(response.data.message);
      router.push('/profile');
    } catch (error) {
      toast.dismiss(loadingToast);
      const err = error as { response?: { data?: { files?: string[]; student?: string[] } } };
      if (err.response?.data?.files) {
        toast.error('Ошибка: ' + err.response.data.files[0]);
      } else if (err.response?.data?.student) {
        toast.error('Ошибка: ' + err.response.data.student);
      } else {
        toast.error('Ошибка при отправке достижения');
      }
    }
  };

  return (
    <>
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="mb-5 flex items-start justify-between gap-4 sm:items-stretch sm:gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
                Загрузка достижения для именной стипендии
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
          <Skeleton name="upload-form-fields" loading={false}>
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
                  value={user?.record_book || ''}
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
                  setCategory(value);
                  setSubType(null);
                  setLevel(null);
                  setResult(null);
                }}
              />

              {/* Вид деятельности */}
              {category && (
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
                      setSubType(selected);
                      setLevel(null);
                      setResult(null);
                    }
                  }}
                />
              )}

              {/* Уровень */}
              {subType?.needsLevel && (
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
                      setLevel(selected);
                    }
                  }}
                />
              )}

              {/* Результат */}
              {subType?.needsResult && (
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
                      setResult(selected);
                    }
                  }}
                />
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
                    setDocType(selected);
                  }
                }}
              />

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
                    value={achievementName}
                    onChange={(e) => setAchievementName(e.target.value)}
                  />
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                    {achievementName.length}/1000
                  </span>
                </div>
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
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                />
              </div>

              {/* Файлы */}
				<div className="space-y-1.5">
					<label className="text-[11px] font-medium text-slate-500">
						Файлы (обязательно)
					</label>
					<FileDropZone files={files} setFiles={setFiles} />
				</div>
            </div>

            {/* Правая колонка: кнопка + QR */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="cursor-pointer inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(52,211,153,0.45)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 w-full sm:w-auto"
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
        </div>
      </section>
    </>
  );
}

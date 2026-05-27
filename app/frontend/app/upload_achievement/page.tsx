'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { useMySession } from '@/context/AuthContext';
import { Skeleton } from 'boneyard-js/react';
import { useRouter } from 'next/navigation';

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

  const [showCategory, setShowCategory] = useState(false);
  const [showSubType, setShowSubType] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showDocType, setShowDocType] = useState(false);

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

  const closeAllDropdowns = () => {
    setShowCategory(false);
    setShowSubType(false);
    setShowLevel(false);
    setShowResult(false);
    setShowDocType(false);
  };

  useEffect(() => {
    document.addEventListener('click', closeAllDropdowns);
    return () => document.removeEventListener('click', closeAllDropdowns);
  });

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
              <div
                className="space-y-1.5 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="text-[11px] font-medium text-slate-500">
                  Категория (обязательно)
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCategory(!showCategory);
                    setShowSubType(false);
                    setShowLevel(false);
                    setShowResult(false);
                    setShowDocType(false);
                  }}
                  className="cursor-pointer flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition hover:border-sky-600 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
                >
                  <span>
                    {category
                      ? dataStructure[category].label
                      : 'Выберите категорию'}
                  </span>
                  <span className="text-xs text-slate-400">▼</span>
                </button>
                {showCategory && (
                  <div
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Object.keys(dataStructure).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="cursor-pointer block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          setCategory(key);
                          setSubType(null);
                          setLevel(null);
                          setResult(null);
                          setShowCategory(false);
                        }}
                      >
                        {dataStructure[key].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Вид деятельности */}
              {category && (
                <div
                  className="space-y-1.5 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="text-[11px] font-medium text-slate-500">
                    Вид деятельности (обязательно)
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubType(!showSubType);
                      setShowCategory(false);
                      setShowLevel(false);
                      setShowResult(false);
                      setShowDocType(false);
                    }}
                    className="cursor-pointer flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition hover:border-slate-400 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
                  >
                    <span>
                      {subType ? subType.label : 'Выберите вид деятельности'}
                    </span>
                    <span className="text-xs text-slate-400">▼</span>
                  </button>
                  {showSubType && (
                    <div
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {dataStructure[category].sub_types.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className="cursor-pointer block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                          onClick={() => {
                            setSubType(item);
                            setLevel(null);
                            setResult(null);
                            setShowSubType(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Уровень */}
              {subType?.needsLevel && (
                <div
                  className="space-y-1.5 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="text-[11px] font-medium text-slate-500">
                    Уровень мероприятия (обязательно)
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLevel(!showLevel);
                      setShowCategory(false);
                      setShowSubType(false);
                      setShowResult(false);
                      setShowDocType(false);
                    }}
                    className="cursor-pointer flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition hover:border-sky-600 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
                  >
                    <span>{level ? level.label : 'Выберите уровень'}</span>
                    <span className="text-xs text-slate-400">▼</span>
                  </button>
                  {showLevel && (
                    <div
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getFilteredLevels().map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className="cursor-pointer block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                          onClick={() => {
                            setLevel(item);
                            setShowLevel(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Результат */}
              {subType?.needsResult && (
                <div
                  className="space-y-1.5 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="text-[11px] font-medium text-slate-500">
                    Результат / Место (обязательно)
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResult(!showResult);
                      setShowCategory(false);
                      setShowSubType(false);
                      setShowLevel(false);
                      setShowDocType(false);
                    }}
                    className="cursor-pointer flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition hover:border-sky-600 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
                  >
                    <span>{result ? result.label : 'Выберите результат'}</span>
                    <span className="text-xs text-slate-400">▼</span>
                  </button>
                  {showResult && (
                    <div
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getFilteredResults().map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className="cursor-pointer block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                          onClick={() => {
                            setResult(item);
                            setShowResult(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Тип документа */}
              <div
                className="space-y-1.5 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="text-[11px] font-medium text-slate-500">
                  Тип документа (обязательно)
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDocType(!showDocType);
                    setShowCategory(false);
                    setShowSubType(false);
                    setShowLevel(false);
                    setShowResult(false);
                  }}
                  className="cursor-pointer flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition hover:border-sky-600 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
                >
                  <span>
                    {docType ? docType.label : 'Выберите тип документа'}
                  </span>
                  <span className="text-xs text-slate-400">▼</span>
                </button>
                {showDocType && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
                    {docTypesList.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        className="cursor-pointer block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          setDocType(item);
                          setShowDocType(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
                <p className="text-[11px] text-slate-400">
                  Максимальный размер файла: 20 МБ, максимум 3 файла. Формат: .doc, .docx, .pdf.
                </p>
                <label className="mt-1 inline-flex w-full cursor-pointer flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left text-xs text-slate-500 transition hover:border-sky-600 hover:bg-slate-100">
                  <input
                    type="file"
                    multiple
                    accept="application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, .doc"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="text-[11px] font-medium text-slate-700">
                    {files.length
                      ? `Файл(ы): ${files.map((f, i) => `${i + 1}. ${f.name}`).join(', ')}`
                      : 'Нажмите, чтобы загрузить документ'}
                  </span>
                </label>
                {files.length === 3 && (
                  <p className="text-[10px] text-amber-600">Максимальное количество файлов (3)</p>
                )}
              </div>
            </div>

            {/* Правая колонка: кнопка + QR */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="cursor-pointer inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-emerald-900 shadow-[0_10px_30px_rgba(52,211,153,0.45)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 w-full sm:w-auto"
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
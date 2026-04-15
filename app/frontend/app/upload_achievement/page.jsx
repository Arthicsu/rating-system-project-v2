'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Skeleton } from 'boneyard-js/react';

export default function UploadAchievement() {
  const router = useRouter();
  const { user, loading: authLoading } = useMySession();

  const [dataStructure, setDataStructure] = useState({});
  const [levelsList, setLevelsList] = useState([]);
  const [resultsList, setResultsList] = useState([]);
  const [docTypesList, setDocTypesList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [recordBook, setRecordBook] = useState(user?.record_book || '');
  const [achievementName, setAchievementName] = useState('');
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState(null);
  const [subType, setSubType] = useState(null);
  const [level, setLevel] = useState(null);
  const [result, setResult] = useState(null);
  const [docType, setDocType] = useState(null);
  const [dateReceived, setDateReceived] = useState('');

  const [showCategory, setShowCategory] = useState(false);
  const [showSubType, setShowSubType] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showDocType, setShowDocType] = useState(false);
    
  useEffect(() => {
    if (user?.record_book) {
      setRecordBook(user.record_book);
    }
  }, [user]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/student/api/v1/achievement-config/');
        const {structure, levels, results, doc_types} = response.data;
        setDataStructure(structure);
        setLevelsList(levels);
        setResultsList(results);
        setDocTypesList(doc_types);
        setLoading(false);
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

  const closeAllDropdowns = () => {
    setShowCategory(false);
    setShowSubType(false);
    setShowLevel(false);
    setShowResult(false);
    setShowDocType(false);
  };

const handleSubmit = async () => {
    if (!recordBook || !category || !subType || !achievementName || !docType || !dateReceived) {
      toast.error("Пожалуйста, заполните все обязательные поля (категория, вид, тип документа, название, дата получения).");
      return;
    }

    const formData = new FormData();
    formData.append('record_book', recordBook);
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

    try {
      const response = await api.post('/student/api/v1/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message);
      router.push('/profile');
    } catch (error) {
      if (error.response?.data?.files) {
        toast.error('Ошибка: ' + error.response.data.files[0]);
      } else if (error.response?.data?.student) {
        toast.error('Ошибка: ' + error.response.data.student);
      } else {
        toast.error('Ошибка при отправке достижения');
      }
    }    
  };

  return (
    <>
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
              Загрузка достижений
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Заполните форму, выберите категорию достижения и прикрепите
              подтверждающий документ.
            </p>
          </div>

          <Skeleton name="upload-form-fields" loading={false}>
            <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] sm:p-5">
              {/* Левая колонка: форма */}
              <div className="space-y-4" onClick={closeAllDropdowns}>
              {/* Номер зачетной */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-500">
                  Номер зачетной книги
                </label>
                <input
                  className="w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70"
                  type="text"
                  value={recordBook}
                  readOnly
                />
              </div>

              {/* Категория */}
              <div
                className="space-y-1.5 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="text-[11px] font-medium text-slate-500">
                  *Категория
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
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition hover:border-sky-400 hover:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70"
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
                        className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
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
                    *Вид деятельности
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
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition hover:border-slate-400 hover:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70"
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
                          className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
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
                    *Уровень мероприятия
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
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition hover:border-slate-400 hover:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70"
                  >
                    <span>{level ? level.label : 'Выберите уровень'}</span>
                    <span className="text-xs text-slate-400">▼</span>
                  </button>
                  {showLevel && (
                    <div
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {levelsList.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
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
                    *Результат / Место
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
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition hover:border-slate-400 hover:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70"
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
                          className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
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
                  *Тип документа
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
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition hover:border-slate-400 hover:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70"
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
                        className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
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
                  *Название достижения (как в документе)
                </label>
                <p className="text-[11px] text-slate-400">
                  Максимальная длина названия: 255 символов
                </p>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/70"
                  type="text"
                  placeholder="Например: Грамота за 1 место в..."
                  value={achievementName}
                  onChange={(e) => setAchievementName(e.target.value)}
                />
              </div>

              {/* Дата получения достижения */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-500">
                  *Дата получения достижения
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/70"
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                />
              </div>

              {/* Файлы */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-500">
                  *Файлы (необязательно)
                </label>
                <p className="text-[11px] text-slate-400">
                  Максимальный размер файла: 20 МБ, максимум 3 файла
                </p>
                <label className="mt-1 inline-flex w-full cursor-pointer flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left text-xs text-slate-500 transition hover:border-sky-400 hover:bg-slate-100">
                  <input
                    type="file"
                    multiple
                    accept="application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, .doc"
                    className="hidden"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      if (selected.length > 3) {
                        toast.error("Максимальное количество файлов - 3");
                        setFiles(selected.slice(0, 3));
                      } else {
                        setFiles(selected);
                      }
                    }}
                  />
                  <span className="text-[11px] font-medium text-slate-700">
                    {files.length
                      ? `Файл(ы): ${files.map((f, i) => `${i + 1}. ${f.name}`).join(', ')}`
                      : 'Нажмите сюда, чтобы загрузить документ'}
                  </span>
                </label>
                {files.length === 3 && (
                  <p className="text-[10px] text-amber-600">Максимальное количество файлов (3)</p>
                )}
              </div>

              {/*Кнопка Загрузить*/}
              <div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    className=" cursor-pointer mt-5 inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-emerald-900 shadow-[0_10px_30px_rgba(52,211,153,0.45)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                  >
                    Загрузить
                  </button>
              </div>
            </div>

            {/* Правая колонка: подсказка + кнопка + QR */}
            <div className="flex flex-col justify-between gap-4">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-sm text-slate-600">
                    Актуальную разбалловку Вы можете узнать, перейдя по ссылке
                    или отсканировав QR-код:
                  </p>
                  <a
                    href="https://clck.ru/3RRp3V"
                    target="_blank"
                    className="mt-2 inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    clck.ru/3RRp3V
                  </a>
                </div>

                <div className="flex justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200">
                    <img
                      src="/media/frame.png"
                      alt="QR"
                      className="h-28 w-28 object-contain"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Система автоматически рассчитает баллы на основе выбранных
                критериев.
              </p>
            </div>
          </div>
          </Skeleton>
        </div>
      </section>
    </>
  );
}
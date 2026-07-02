'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { studentApi } from '@/lib/apiRequests';
import type { ModalEditAchievementProps } from '@/interfaces/ModalInterfaces';
import FileDropZone from '@/components/upload/FileDropZone';

export default function ModalEditAchievement({
  isOpen,
  doc,
  onClose,
  onSaved,
}: ModalEditAchievementProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seededDocId, setSeededDocId] = useState<number | null>(null);
  const [achievementName, setAchievementName] = useState('');
  const [dateReceived, setDateReceived] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Заполняем форму при открытии модалки новой заявкой.
  if (doc && doc.id !== seededDocId) {
    setSeededDocId(doc.id);
    setAchievementName(doc.achievement ?? '');
    setDateReceived(doc.date_received ? doc.date_received.slice(0, 10) : '');
    setFiles([]);
  }

  useEffect(() => {
    if (isOpen && !closing) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, closing]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleClose = useCallback(() => {
    if (saving) return;
    setVisible(false);
    setClosing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose();
      setClosing(false);
      setSeededDocId(null); // позволяет переоткрыть ту же заявку с актуальными данными
    }, 200);
  }, [onClose, saving]);

  if ((!isOpen && !closing) || !doc) return null;

  const isRejected = doc.status_display === 'rejected';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!achievementName.trim()) {
      toast.error('Укажите название достижения');
      return;
    }
    if (!dateReceived) {
      toast.error('Укажите дату получения');
      return;
    }

    const formData = new FormData();
    formData.append('achievement', achievementName.trim());
    formData.append('date_received', dateReceived);
    files.forEach(f => formData.append('files', f));

    setSaving(true);
    try {
      await studentApi.updateAchievement(doc.id, formData);
      toast.success(isRejected ? 'Сохранено и отправлено на повторное рассмотрение' : 'Изменения сохранены');
      onSaved();
      handleClose();
    } catch (error) {
      const err = error as { response?: { data?: { files?: string[]; detail?: string } } };
      toast.error('Ошибка: ' + (err.response?.data?.files?.[0] ?? err.response?.data?.detail ?? 'не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-0 transition-all duration-200 ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6 transform transition-all duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <button
          type="button"
          className="cursor-pointer absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          onClick={handleClose}
        >
          &times;
        </button>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Редактирование достижения
        </h2>

        {isRejected && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            После сохранения заявка будет повторно отправлена на рассмотрение.
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="edit-achievement-name" className="text-[11px] font-medium text-slate-500">
              Название достижения
            </label>
            <div className="relative">
              <textarea
                id="edit-achievement-name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600 resize-none"
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

          <div className="space-y-1.5">
            <label htmlFor="edit-date-received" className="text-[11px] font-medium text-slate-500">
              Дата получения достижения
            </label>
            <input
              id="edit-date-received"
              type="date"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600"
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500">
              Заменить файлы (необязательно)
            </label>
            <p className="text-[11px] text-slate-400">
              Если выбрать новые файлы — старые будут заменены. Перетащите или выберите до 3 файлов, общий размер до 20 МБ.
            </p>
            <FileDropZone files={files} setFiles={setFiles} />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleClose}
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import type { PendingDocumentDto } from '@/lib/api';

import CollapsibleText from './CollapsibleText';

/** Дата по Москве, как на сервере: иначе в другом часовом поясе сдвинется на сутки. */
export function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
}

/** Сведения о заявке: название (свёрнуто до 4 строк) и список «поле: значение». */
export default function AchievementDetails({ doc }: { doc: PendingDocumentDto }) {
  const rows: [string, string | null | undefined][] = [
    ['Категория', doc.category_display],
    ['Вид деятельности', doc.sub_type_display],
    ['Уровень', doc.level_display],
    ['Результат', doc.result_display],
    ['Тип документа', doc.doc_type_display],
    ['Семестр', doc.semester_label],
    ['Дата получения', formatDate(doc.date_received)],
    ['Дата подачи', formatDate(doc.uploaded_at)],
  ];

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Достижение</h2>
      <CollapsibleText text={doc.achievement || '—'} />
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-slate-600">{label}</dt>
              <dd className="break-words font-medium text-slate-900">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

/** Блок причины: «Причина отклонения», «Ранее отклонялась» и т. п. */
export function ReasonNote({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm sm:p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">{title}</h2>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{text}</p>
    </section>
  );
}

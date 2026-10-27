import Link from 'next/link';

export interface DocumentSection {
  /** Якорь раздела для оглавления. */
  id: string;
  title: string;
  content: React.ReactNode;
}

/** Документы, на которые ссылается баннер cookie, - в одном месте для баннера и страниц. */
export const POLICY_DOCUMENTS = [
  { href: '/privacy-policy', title: 'Политика обработки персональных данных' },
  { href: '/pd-consent', title: 'Согласие на обработку персональных данных' },
  { href: '/cookie-policy', title: 'Политика использования файлов cookie' },
] as const;

/**
 * Страница-документ: заголовок, дата редакции, плашка «текст-заглушка», оглавление и
 * нумерованные разделы; внизу - ссылки на остальные документы.
 */
export default function DocumentPage({
  href,
  sections,
}: {
  href: (typeof POLICY_DOCUMENTS)[number]['href'];
  sections: DocumentSection[];
}) {
  const title = POLICY_DOCUMENTS.find((doc) => doc.href === href)!.title;
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">Портал «Портфолио БГИТУ». Редакция от [уточнить дату]</p>
      <p role="note" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Текст-заглушка: будет заменён утверждённым текстом БГИТУ. Места, которые нужно уточнить, помечены
        «[уточнить]».
      </p>

      <nav aria-label="Содержание" className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Содержание</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-sky-700 underline-offset-2 hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, index) => (
        <section key={section.id} id={section.id} className="mt-8 scroll-mt-24">
          <h2 className="text-lg font-semibold text-slate-900">
            {index + 1}. {section.title}
          </h2>
          <div className="mt-2 space-y-2 text-base leading-relaxed text-slate-700 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {section.content}
          </div>
        </section>
      ))}

      <nav aria-label="Другие документы" className="mt-10 border-t border-slate-100 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Другие документы</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {POLICY_DOCUMENTS.filter((doc) => doc.href !== href).map((doc) => (
            <li key={doc.href}>
              <Link href={doc.href} className="text-sky-700 underline-offset-2 hover:underline">
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}

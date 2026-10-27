/** Каркас страниц-документов (политики и согласие): колонка для чтения, отступ под шапку. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 pt-24 pb-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-5">{children}</div>
    </main>
  );
}

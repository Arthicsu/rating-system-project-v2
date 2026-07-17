/**
 * Ручной pulse-макет профиля. Используется веткой loading в StudentProfile:
 * задаёт высоту контейнера под кости boneyard и остаётся запасным вариантом
 * до гидрации бандла.
 */
export default function ProfileSkeleton() {
  return (
    <section className="min-h-screen bg-slate-50 pt-24 pb-10">
      <div className="mx-auto max-w-350 px-4 sm:px-5">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 animate-pulse">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="h-6 w-48 rounded bg-slate-200" />
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-4 w-40 rounded bg-slate-200" />
            </div>
            <div className="h-16 w-24 rounded-xl bg-slate-200" />
          </div>
          <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-3">
            <div className="col-span-2 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="space-y-2">
                <div className="h-8 rounded bg-slate-200" />
                <div className="h-8 rounded bg-slate-200" />
                <div className="h-8 rounded bg-slate-200" />
              </div>
            </div>
            <div className="h-72 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <div className="h-4 w-40 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

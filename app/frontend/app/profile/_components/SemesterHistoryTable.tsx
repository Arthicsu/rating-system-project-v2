import type { SemesterScoreHistory } from '@/interfaces/ProfileInterfaces';

/** История баллов по семестрам. */
export default function SemesterHistoryTable({ semesterHistory }: { semesterHistory: SemesterScoreHistory[] }) {
  if (semesterHistory.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 sm:text-base">
        История баллов по семестрам
      </h2>
      <div className="w-full overflow-x-auto">
        <table className="min-w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="px-2 py-2 text-left font-medium">Семестр</th>
              <th className="px-2 py-2 text-center font-medium">Учебная</th>
              <th className="px-2 py-2 text-center font-medium">Научная</th>
              <th className="px-2 py-2 text-center font-medium">Спорт</th>
              <th className="px-2 py-2 text-center font-medium">Обществ.</th>
              <th className="px-2 py-2 text-center font-medium">Творч.</th>
              <th className="px-2 py-2 text-center font-semibold text-slate-700">Итого</th>
            </tr>
          </thead>
          <tbody>
            {semesterHistory.map((s) => (
              <tr key={s.semester_id} className="border-t border-slate-100">
                <td className="px-2 py-2 text-left text-slate-800">
                  {s.semester_label}
                  {s.is_current && (
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                      текущий
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{s.academic_score}</td>
                <td className="px-2 py-2 text-center">{s.research_score}</td>
                <td className="px-2 py-2 text-center">{s.sport_score}</td>
                <td className="px-2 py-2 text-center">{s.social_score}</td>
                <td className="px-2 py-2 text-center">{s.cultural_score}</td>
                <td className="px-2 py-2 text-center font-bold text-sky-700">{s.total_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

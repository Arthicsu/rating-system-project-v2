/** Вкладки ленты заявок кабинета студента; 'all' - без фильтра. */
export const STATUS_TABS = ['all', 'approved', 'pending', 'rejected'] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

export const PAGE_SIZE = 10;

export interface ListState {
  status: StatusTab;
  /** Код категории или 'all'. */
  category: string;
  page: number;
}

const DEFAULTS: ListState = { status: 'all', category: 'all', page: 1 };

/**
 * Страница ленты по вкладке статуса и категории. Счётчики вкладок считаются в выбранной категории,
 * счётчики категорий - во вкладке: число на кнопке совпадает с тем, что она покажет.
 */
export function listAchievements<T extends { status_display: string; category_code: string }>(
  docs: T[],
  { status, category, page }: ListState,
) {
  const inCategory = docs.filter((d) => category === 'all' || d.category_code === category);
  const inStatus = docs.filter((d) => status === 'all' || d.status_display === status);

  const statusCounts: Record<StatusTab, number> = { all: inCategory.length, approved: 0, pending: 0, rejected: 0 };
  for (const d of inCategory) {
    if (d.status_display === 'approved' || d.status_display === 'pending' || d.status_display === 'rejected') {
      statusCounts[d.status_display] += 1;
    }
  }
  const categoryCounts = new Map<string, number>([['all', inStatus.length]]);
  for (const d of inStatus) categoryCounts.set(d.category_code, (categoryCounts.get(d.category_code) ?? 0) + 1);

  const matching = inStatus.filter((d) => category === 'all' || d.category_code === category);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), pages);
  return {
    items: matching.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    total: matching.length,
    page: current,
    pages,
    statusCounts,
    categoryCounts,
  };
}

/** Состояние ленты из адреса; неизвестные и испорченные значения - по умолчанию. */
export function readListState(params: { get(key: string): string | null }, categoryCodes: readonly string[]): ListState {
  const status = params.get('status');
  const category = params.get('category');
  const page = params.get('page');
  return {
    status: STATUS_TABS.find((tab) => tab === status) ?? DEFAULTS.status,
    category: category !== null && categoryCodes.includes(category) ? category : DEFAULTS.category,
    page: page !== null && /^[1-9]\d{0,5}$/.test(page) ? Number(page) : DEFAULTS.page,
  };
}

/** Строка адреса ленты; значения по умолчанию не пишутся. */
export function listQuery(state: ListState) {
  const params = new URLSearchParams();
  if (state.status !== DEFAULTS.status) params.set('status', state.status);
  if (state.category !== DEFAULTS.category) params.set('category', state.category);
  if (state.page !== DEFAULTS.page) params.set('page', String(state.page));
  return params.toString();
}

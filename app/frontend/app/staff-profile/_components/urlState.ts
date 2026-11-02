export const TAB_IDS = ['my-group', 'pending-requests', 'reviewed-requests', 'statistics'] as const;

// Состояние кабинета живёт в адресе: «Подробнее» → «Назад» возвращает в то же место,
// ссылку можно переслать. В адрес попадает только отличное от значения по умолчанию.
export const URL_DEFAULTS = {
  tab: 'my-group', faculty: 'all', course: 'all', group: 'all', period: '',
  cat: 'common', q: '', page: '1',
  rstate: 'all', rq: '', rpage: '1',
  vstate: 'all', vq: '', vpage: '1',
};
export type UrlState = typeof URL_DEFAULTS;

/** Адрес — пользовательский ввод: неизвестные значения заменяются значениями по умолчанию. */
export function readUrlState(params: { get(key: string): string | null }): UrlState {
  const get = (key: keyof UrlState, valid: (value: string) => boolean) => {
    const value = params.get(key);
    return value !== null && valid(value) ? value : URL_DEFAULTS[key];
  };
  const id = (v: string) => /^\d{1,9}$/.test(v);
  const page = (v: string) => /^[1-9]\d{0,5}$/.test(v);
  const text = (v: string) => v.length <= 100;
  const oneOf = (...values: readonly string[]) => (v: string) => values.includes(v);
  return {
    tab: get('tab', oneOf(...TAB_IDS)),
    faculty: get('faculty', id),
    course: get('course', oneOf('1', '2', '3', '4', '5')),
    group: get('group', id),
    period: get('period', (v) => /^(year|sem):\d{1,9}$/.test(v)),
    // Неизвестную категорию сервер сортирует по общему баллу.
    cat: get('cat', (v) => /^\w{1,50}$/.test(v)),
    q: get('q', text),
    page: get('page', page),
    rstate: get('rstate', oneOf('new', 'returned')),
    rq: get('rq', text),
    rpage: get('rpage', page),
    vstate: get('vstate', oneOf('approved', 'rejected')),
    vq: get('vq', text),
    vpage: get('vpage', page),
  };
}

/** Строка адреса кабинета: только значения, отличные от значений по умолчанию. */
export function urlQuery(state: UrlState): string {
  return new URLSearchParams(
    Object.entries(state).filter(([key, value]) => value !== URL_DEFAULTS[key as keyof UrlState]),
  ).toString();
}

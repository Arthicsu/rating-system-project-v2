/**
 * Путь возврата после входа из ?next= - только на этот же сайт, иначе «/».
 * Строку разбирает URL, как это сделает браузер: «/\host», «//host» и «http://host» ведут на чужой сайт.
 */
export function safeNextPath(next: string | null, origin: string): string {
  if (!next) return '/';
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : '/';
  } catch {
    return '/';
  }
}

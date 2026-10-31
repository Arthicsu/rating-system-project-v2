/** Первая ссылка страницы: с клавиатуры сразу к содержимому, мимо шапки. Видна только в фокусе. */
export default function SkipLink() {
  return (
    <a
      href="#content"
      className="sr-only bg-sky-700 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
    >
      К содержимому
    </a>
  );
}

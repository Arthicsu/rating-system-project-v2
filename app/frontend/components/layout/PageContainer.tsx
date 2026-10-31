const WIDTH = {
  wide: 'max-w-350 sm:py-8',
  narrow: 'max-w-2xl sm:py-8',
  text: 'max-w-3xl sm:py-8',
  auth: 'max-w-md sm:py-12',
};

/** Ширина и отступы содержимого страницы: wide - кабинеты и заявки, narrow - настройки, text - документы, auth - вход. */
export default function PageContainer({
  width = 'wide',
  className = '',
  children,
}: {
  width?: keyof typeof WIDTH;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`mx-auto w-full px-4 py-6 sm:px-5 ${WIDTH[width]} ${className}`}>{children}</div>;
}

import Image from 'next/image';
import Link from 'next/link';

const HEADING = 'text-sm font-semibold text-slate-900';
const LINK = 'inline-flex items-center gap-2 py-1 text-sm text-slate-600 transition-colors hover:text-sky-700';
// 1.25em - ширина иконок Font Awesome: подписи ссылок стоят ровно при любом размере шрифта.
const ICON = 'size-[1.25em] shrink-0';
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Подвал всех страниц: вуз, системы вуза, поддержка и документы о персональных данных, версия сайта. */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-350 gap-8 px-4 py-8 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <div className="space-y-3">
          <Image
            src="/media/logo_BGITU.svg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-auto object-contain dark:invert dark:hue-rotate-180"
          />
          <p className="text-sm font-semibold text-slate-900">
            Брянский государственный инженерно-технологический университет
          </p>
          <p className="text-sm text-slate-600">Портфолио достижений студентов</p>
        </div>

        {/* Адрес положения (документ к постановлению 6-117) пока неизвестен: колонка вернётся вместе со ссылкой.
        <div className="space-y-2">
          <h2 className={HEADING}>Именная стипендия</h2>
          <a href="" {...EXTERNAL} className={LINK}>
            Положение об именной стипендии
          </a>
        </div> */}

        <div className="space-y-2">
          <h2 className={HEADING}>Системы вуза</h2>
          <ul>
            <li>
              <a href="https://eos.bgitu.ru/" {...EXTERNAL} className={LINK}>
                <Image src="/media/logo_EOS.svg" alt="" width={20} height={20} className={`${ICON} rounded-[25%]`} />
                ЭОС БГИТУ
              </a>
            </li>
            <li>
              <a href="https://compass.bgitu.ru/" {...EXTERNAL} className={LINK}>
                <Image src="/media/logo_COMPASS.svg" alt="" width={20} height={20} className={`${ICON} rounded-[25%]`} />
                БГИТУ Компас
              </a>
            </li>
            <li>
              <a href="https://it.bgitu.ru/" {...EXTERNAL} className={LINK}>
                <Image src="/media/logo_IT.png" alt="" width={20} height={20} className={`${ICON} object-contain dark:invert dark:hue-rotate-180`} />
                Кафедра ИТ
              </a>
            </li>
            <li>
              <a href="https://bgitu.ru/" {...EXTERNAL} className={LINK}>
                {/* Герб занимает в файле 3/4 холста: увеличение выравнивает его по размеру с соседними значками. */}
                <Image src="/media/logo_BGITU_color.svg" alt="" width={20} height={20} className={`${ICON} scale-133`} />
                Сайт вуза
              </a>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className={HEADING}>Поддержка</h2>
          <ul>
            <li>
              <a href="mailto:oi@bgitu.ru" className={LINK}>
                Технические вопросы: oi@bgitu.ru
              </a>
            </li>
            <li>
              <Link href="/privacy-policy" className={LINK}>
                Политика обработки персональных данных
              </Link>
            </li>
            <li>
              <Link href="/pd-consent" className={LINK}>
                Согласие на обработку персональных данных
              </Link>
            </li>
            <li>
              <Link href="/cookie-policy" className={LINK}>
                Политика использования файлов cookie
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <p className="mx-auto max-w-350 px-4 py-4 text-xs text-slate-500 sm:px-5">
          © {new Date().getFullYear()} БГИТУ · Портфолио БГИТУ · Версия {process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </div>
    </footer>
  );
}

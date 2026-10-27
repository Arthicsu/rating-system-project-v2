import type { Metadata } from 'next';

import DocumentPage, { type DocumentSection } from '@/components/DocumentPage';

export const metadata: Metadata = { title: 'Политика использования файлов cookie' };

// Текст-заглушка до утверждённого текста БГИТУ. Перечень cookie - фактический (сессия Django,
// CSRF и отметка баннера): при появлении новых cookie обновить раздел 2.
const SECTIONS: DocumentSection[] = [
  {
    id: 'what',
    title: 'Что такое файлы cookie',
    content: (
      <p>
        Файлы cookie — небольшие текстовые файлы, которые сайт сохраняет в браузере и получает обратно при
        следующих обращениях. Портал «Портфолио БГИТУ» (далее — Портал) использует их только для работы
        сайта.
      </p>
    ),
  },
  {
    id: 'which',
    title: 'Какие cookie использует Портал',
    content: (
      <>
        <ul>
          <li>
            <code>sessionid</code> — сессия входа: без неё Портал не узнаёт вошедшего пользователя. Недоступен
            скриптам страницы, действует 12 часов [уточнить].
          </li>
          <li>
            <code>csrftoken</code> — защита форм от подделки запросов с чужих сайтов; хранится около года.
          </li>
          <li>
            <code>users_cookie_accepted</code> — отметка, что вы ознакомились с уведомлением об обработке
            данных; хранится один год.
          </li>
        </ul>
        <p>Портал не использует cookie для рекламы и не подключает сервисы веб-аналитики [уточнить].</p>
      </>
    ),
  },
  {
    id: 'manage',
    title: 'Как управлять cookie',
    content: (
      <p>
        Удалить или запретить cookie можно в настройках браузера. Без cookie сессии и защиты форм войти на
        Портал и отправить заявку не получится.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Изменение политики',
    content: (
      <p>
        Оператор может обновлять эту Политику; действующая редакция всегда опубликована на этой странице
        [уточнить].
      </p>
    ),
  },
];

export default function CookiePolicyPage() {
  return <DocumentPage href="/cookie-policy" sections={SECTIONS} />;
}

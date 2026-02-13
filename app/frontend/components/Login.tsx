// frontend/app/page.tsx
import Link from 'next/link';

export default function Home() {
    return (
    <>
      <section className="main">
        <div className="container">
          <div className="main-info">
            <h1 className="main-title">
              Авторизация пользователя
            </h1>
          </div>
          <div className="main-widgets">
            <div className="main-widgets__content">
              <div className="main-widgets__flex">
                <img src="/media/logo_BGITU.png" alt="БГИТУ" className="main-img" />
                <p className="main-logo__subtitle">
                  БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
                  ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
                  УНИВЕРСИТЕТ —
                  ВЫСШЕЕ УЧЕБНОЕ ЗАВЕДЕНИЕ БРЯНСКА.
                </p>
              </div>
              <p className="main-subtitle">
                «Единый личный кабинет» является единым информационным пространством БГИТУ.
              </p>
              <p className="main-subtitle">
                При невозможности восстановить пароль или авторизоваться вы можете обратиться на Горячую линию поддержки. <br />
                Горячая линия БГИТУ работает с 8.30 до 18.00 - прием звонков, обработка и регистрация принятых сообщений (пн-пт): <br />
                +7 (4832) 64-99-12
              </p>
              <p>email: <a className="main-email" href="mailto:mail@bgitu.ru">mail@bgitu.ru</a></p>
            </div>
            <div className="main-widgets__item">
              <p className="main-button__pad">
                <Link href="/register" className="main-button"> Зарегистрироваться </Link>
              </p>
              <p className="main-button__pad">
                <Link href="/login" className="main-button">Войти</Link>
              </p>
              <a href="#" className="main-link__password">Восстановить пароль</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
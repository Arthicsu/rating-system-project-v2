// frontend/app/page.tsx
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <section className="min-h-screen bg-[#EDEFF3] px-4 pt-30 pb-10">
      <div className="mx-auto flex max-w-300 flex-col gap-6 rounded-2xl bg-white/90 p-6 shadow-sm items-center lg:flex-row md:gap-8 md:px-10 md:py-8">
        {/* Левая колонка с описанием */}
        <div className="flex-1 space-y-4">
          <p className="text-xl bold font-semibold text-black sm:text-2xl md:text-3xl">
            Авторизация пользователя
          </p>

          <div className="flex items-center gap-4 pb-4 md:gap-6">
            <Image
              src="/media/logo_BGITU.png"
              alt="БГИТУ"
              width={80}
              height={80}
              className="h-20 w-auto object-contain md:h-24"
            />
            <p className="text-xs font-semibold text-[#0050CF] md:text-base sm:text-sm">
              БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
              ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
              УНИВЕРСИТЕТ — ВЫСШЕЕ УЧЕБНОЕ <br />
              ЗАВЕДЕНИЕ БРЯНСКА.
            </p>
          </div>

          <p className="text-xs text-[#333] md:text-base sm:text-sm">
            «Единый личный кабинет» является единым информационным пространством БГИТУ.
          </p>
          <p className="text-xs text-[#333] md:text-base sm:text-sm">
            При невозможности восстановить пароль или авторизоваться вы можете обратиться на
            Горячую линию поддержки. <br />
            Горячая линия БГИТУ работает с 8:30 до 18:00 (пн–пт): <br />
            <span className="font-semibold">+7 (4832) 64-99-12</span>
          </p>
          <p className="text-xs text-[#333] md:text-base sm:text-sm">
            email:{' '}
            <a
              className="text-[#0050CF] underline underline-offset-2 hover:text-[#002D6E]"
              href="mailto:mail@bgitu.ru"
            >
              mail@bgitu.ru
            </a>
          </p>
        </div>

        {/* Правая колонка с действиями */}
        <div className="flex w-full max-w-xs flex-col items-stretch justify-center gap-3 rounded-2xl bg-[#F5F7FB] px-5 py-6 shadow-sm md:max-w-sm">
          <button className="w-full rounded-md bg-[#0050CF] text-sm font-semibold text-white transition hover:bg-[#002D6E]">
            <Link href="/register" className="block w-full text-center px-4 py-3">
              Зарегистрироваться
            </Link>
          </button>

          <button className="w-full rounded-md bg-white text-sm font-semibold text-[#0050CF] ring-1 ring-[#0050CF] transition hover:bg-[#0050CF] hover:text-white">
            <Link href="/login" className="block w-full text-center px-4 py-3">
              Войти
            </Link>
          </button>

          <button className="mt-1 text-center text-xs text-[#6a7a98] underline underline-offset-2 hover:text-[#0050CF]">
            Восстановить пароль
          </button>
        </div>
      </div>
    </section>
  );
}
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { registerUser } = useMySession();

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    patronymic: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (formData.password !== formData.passwordConfirm) {
      setError('Пароли не совпадают');
      toast.error('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    try {
      await registerUser({
        last_name: formData.lastName,
        first_name: formData.firstName,
        patronymic: formData.patronymic,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      router.push('/');
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData) {
        toast.error(JSON.stringify(errorData));
      } else {
        toast.error('Ошибка регистрации. Повторите попытку позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#EDEFF3] px-4 pt-35 pb-10">
      <div className="mx-auto flex max-w-275 flex-col gap-8">
        {/* Форма регистрации */}
        <div className="mx-auto w-full max-w-xl rounded-2xl bg-white px-6 py-8 shadow-md md:px-10">
          <h1 className="mb-6 text-2xl font-semibold text-black sm:text-3xl">
            Регистрация
          </h1>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">
                Фамилия<span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">
                Имя<span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">Отчество</label>
              <input
                type="text"
                name="patronymic"
                value={formData.patronymic}
                onChange={handleChange}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">
                E-mail<span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">Телефон</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+7(___)___-__-__"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">
                Пароль<span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">
                Повторите пароль<span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0050CF] focus:ring-1 focus:ring-[#0050CF]"
              />
            </div>

            <div className="rounded-lg bg-[#F0F5FF] px-4 py-3 text-xs text-[#002D6E]">
              <p>
                Длина пароля должна быть не менее 10 символов. Пароль должен состоять из букв латинского
                алфавита (A–z), арабских цифр (0–9) и специальных символов (@#$%&*).
              </p>
            </div>

            {error && (
              <p className="text-sm text-rose-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-md bg-[#0050CF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#002D6E] disabled:cursor-not-allowed disabled:bg-[#6B7A99]"
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>

        {/* Правый информационный блок */}
        <div className="flex w-full flex-col items-center justify-between gap-4 text-center ">
          <p className="text-sm text-black md:text-base">
            Если у Вас возникли технические сложности, свяжитесь с нами по email:{' '}
            <a
              href="mailto:mail@bgitu.ru"
              className="font-semibold text-[#0050CF] underline underline-offset-2 hover:text-[#002D6E]"
            >
              mail@bgitu.ru
            </a>
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs content-center font-medium text-[#0050CF] md:text-sm md:text-right md:self-stretch">
              BRYANSK STATE <br />
              TECHNOLOGICAL UNIVERSITY <br />
              OF ENGINEERING
            </p>
            <img
              src="/media/logo_BGITU.png"
              alt="Logo"
              className="h-16 w-auto object-contain md:h-20"
            />
            <p className="text-xs content-center font-medium text-[#0050CF] md:text-sm md:text-left md:self-stretch">
              БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
              ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
              УНИВЕРСИТЕТ
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
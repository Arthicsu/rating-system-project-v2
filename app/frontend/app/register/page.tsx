'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import type RegisterFormData from '@/interfaces/RegisterInterfaces';
import type ApiError from '@/interfaces/GeneralInterfaces';

export default function RegisterPage() {
  const router = useRouter();
  const { registerUser } = useMySession();

  const [formData, setFormData] = useState<RegisterFormData>({
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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
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

      toast.success('Регистрация успешна!');
      router.push('/');
    } catch (err) {
      const error = err as ApiError;
      const errorData = error.response?.data;
      
      if (errorData) {
        const firstError = Object.values(errorData).flat().join(', ');
        toast.error(firstError || 'Ошибка регистрации');
      } else {
        toast.error('Ошибка регистрации. Повторите попытку позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700";

  return (
    <section className="min-h-screen bg-slate-100 px-4 pt-35 pb-10">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
        <div className="mx-auto w-full max-w-xl rounded-2xl bg-white px-6 py-8 shadow-md md:px-10">
          <h1 className="mb-6 text-2xl font-semibold text-slate-900 sm:text-3xl">
            Регистрация
          </h1>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="lastName" className="text-sm font-medium text-slate-600">
                Фамилия<span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="firstName" className="text-sm font-medium text-slate-600">
                Имя<span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="patronymic" className="text-sm font-medium text-slate-600">
                Отчество
              </label>
              <input
                type="text"
                id="patronymic"
                name="patronymic"
                value={formData.patronymic}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-600">
                E-mail<span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="text-sm font-medium text-slate-600">
                Телефон
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+7(___)___-__-__"
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-600">
                Пароль<span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-600">
                Повторите пароль<span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                id="passwordConfirm"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="rounded-lg bg-sky-50 px-4 py-3 text-xs text-sky-800">
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
              className="mt-2 w-full rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>

        <div className="flex w-full flex-col items-center justify-between gap-4 text-center">
          <p className="text-sm text-slate-700 md:text-base">
            Если у Вас возникли технические сложности, свяжитесь с нами по email:{' '}
            <a
              href="mailto:mail@bgitu.ru"
              className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
            >
              mail@bgitu.ru
            </a>
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs text-center font-medium text-sky-700 md:text-sm md:text-right">
              BRYANSK STATE <br />
              TECHNOLOGICAL UNIVERSITY <br />
              OF ENGINEERING
            </p>
            <img
              src="/media/logo_BGITU.png"
              alt="Логотип"
              className="h-16 w-auto object-contain md:h-20"
            />
            <p className="text-xs text-center font-medium text-sky-700 md:text-sm md:text-left">
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
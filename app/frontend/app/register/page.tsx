'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';

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

    if (formData.password != formData.passwordConfirm) {
      setError('Пароли не совпадают');
      alert("Пароли не совпадают");
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
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData) {
        alert(JSON.stringify(errorData));
      } else {
        alert("Ошибка регистрации. Повторите попытку позже.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      <section className="registration">
        <div className="registration-container">
          <div className="registration-form">
            <h1 className="registration-role">Регистрация</h1>
            <form className="registration-form__form" onSubmit={handleSubmit}>
              <div className="registration-form__field">
                <label className="label-registration">Фамилия*</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="registration-input__field" />
              </div>
              <div className="registration-form__field">
                <label className="label-registration">Имя*</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="registration-input__field" />
              </div>
              <div className="registration-form__field">
                <label className="label-registration">Отчество</label>
                <input type="text" name="patronymic" value={formData.patronymic} onChange={handleChange} className="registration-input__field" />
              </div>
              <div className="registration-form__field">
                <label className="label-registration">E-mail*</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required className="registration-input__field" />
              </div>
              <div className="registration-form__field">
                <label className="label-registration">Телефон</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="8(___)___-__-__" className="registration-input__field" />
              </div>
              <div className="registration-form__field">
                <label className="label-registration">Пароль*</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} required className="registration-input__field" />
              </div>
              <div className="registration-form__field">
                <label className="label-registration">Повторите пароль*</label>
                <input type="password" name="passwordConfirm" value={formData.passwordConfirm} onChange={handleChange} required className="registration-input__field" />
              </div>

              <div className="form-alert__info">
                <p>
                  Длина пароля должна быть не менее 10 символов. Пароль должен состоять из букв латинского алфавита (A-z), арабских цифр (0-9) и специальных символов (@#$%&*)
                </p>
              </div>

              <input className="registration-button" name="registration" type="submit" disabled={isLoading} value="Зарегистрироваться" />
            </form>
          </div>

          <div className="registration-logo">
            <p className="registration-text">
              Если у Вас возникли технические сложности, свяжитесь с нами по email: <a href="mailto:mail@bgitu.ru" className="registration-email">mail@bgitu.ru</a>
            </p>
          </div>

          <div className="registration-footer">
            <p className="registration-info__rtl">
              BRYANSK STATE <br />
              TECHNOLOGICAL UNIVERSITY <br />
              OF ENGINEERING
            </p>
            <div className="registration-img">
              <img src="/media/logo_BGITU.png" alt="Logo" className="registration-bgitu" />
            </div>
            <p className="registration-info">
              БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
              ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
              УНИВЕРСИТЕТ
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
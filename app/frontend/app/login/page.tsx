'use client'; // Вот это значит, что код выполняется в браузере (нужно для useEffect и useState). 
// Это обязательно для обработки форм

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
const { loginUser, user } = useMySession();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
  if (user && !isLoading) {
    router.push('/');
  }
  }, [user, isLoading, router]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginUser(formData);
      router.push('/');
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData) {
        alert(JSON.stringify(errorData));
      } else {
        alert("Ошибка авторизации. Повторите попытку позже.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="login">
      <div className="login-container">
        <div className="login-form">
          <h1 className="login-role">Авторизация</h1>
          <form className="login-form__form" onSubmit={handleSubmit}>
            <div className="login-form__field">
              <label className="label-login">E-mail</label>
              <div className="login-input">
                <input 
                  type="text" 
                  id="username" 
                  name="username" 
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="login-input__field" 
                />
              </div>
            </div>
            <div className="login-form__field">
              <label className="label-login">Пароль</label>
              <div className="login-input">
                <input 
                  type="password" 
                  name="password" 
                  value={formData.password}
                  onChange={handleChange}
                  className="login-input__field" 
                  required
                  id="passwordInput" 
                />
              </div>
            </div>
            <input className="login-button" name="login" type="submit" disabled={isLoading} value={isLoading ? "Вход..." : "Войти"} />
          </form>
          <p className="login-form__links">
            <Link className="login-link" href="/register">Зарегистрироваться</Link>
            <span className="login-separator"></span>
            <Link className="login-link" href="/restore">Восстановить пароль</Link>
          </p>
        </div>

        <div className="login-logo">
          <p className="login-text">
            Если у Вас возникли технические сложности, свяжитесь с нами по email: <a href="mailto:mail@bgitu.ru" className="login-email">mail@bgitu.ru</a>
          </p>
        </div>

        <div className="login-footer">
          <p className="login-info__rtl">
            BRYANSK STATE <br />
            TECHNOLOGICAL UNIVERSITY <br />
            OF ENGINEERING
          </p>
          <div className="login-img">
            <img src="/media/logo_BGITU.png" alt="Логотип БГИТУ" className="login-bgitu" />
          </div>
          <p className="login-info">
            БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
            ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
            УНИВЕРСИТЕТ
          </p>
        </div>
      </div>
    </section>
  );
}
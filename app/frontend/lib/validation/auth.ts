import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({
  email: z.email('Введите корректный email'),
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

/** Регистрация отключена (страница скрыта в app/_register), схема сохранена для неё. */
export const registerSchema = z
  .object({
    last_name: z.string().min(1, 'Введите фамилию'),
    first_name: z.string().min(1, 'Введите имя'),
    patronymic: z.string().optional(),
    email: z.email('Введите корректный email'),
    record_book: z.string().min(1, 'Введите номер зачётной книжки'),
    password: z.string().min(10, 'Пароль должен быть не короче 10 символов'),
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: 'Пароли не совпадают',
    path: ['passwordConfirm'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

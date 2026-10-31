import type { AuthUser } from '@/interfaces/AuthInterfaces';

/** Инициалы для кнопки меню на телефоне: первые буквы двух первых слов ФИО. */
export function initials(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** Вторая строка сводки в меню: зачётка студента или старшая роль сотрудника. */
export function roleLabel(user: Pick<AuthUser, 'is_employee' | 'roles' | 'record_book'>): string {
  if (!user.is_employee) return `Студент · зачётка ${user.record_book}`;
  if (user.roles.includes('Rectorate')) return 'Ректорат';
  if (user.roles.includes('Dean')) return 'Деканат';
  if (user.roles.includes('Department')) return 'Кафедра';
  return 'Сотрудник';
}

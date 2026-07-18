from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction

from core.admin_password_generator import generate_password
from students.models import Document


@transaction.atomic
def register_student(*, email, password, first_name, last_name, patronymic='', record_book):
    """
    Создать пользователя-студента с профилем Student и группой 'Student'.

    Используется StudentRegistrationSerializer. Сама регистрация сейчас
    отключена (маршрут закомментирован), но код сохранён.
    """
    from students.models import Student

    user = get_user_model().objects.create_user(
        username=email,
        first_name=first_name,
        last_name=last_name,
        patronymic=patronymic,
        email=email,
        password=password,
    )

    user.groups.add(Group.objects.get(name='Student'))

    Student.objects.create(
        user=user,
        group=None,
        record_book=record_book,
        full_name=user.get_full_name(),
    )

    return user


def reset_user_password(user) -> str:
    """
    Генерирует новый временный пароль, сохраняет его пользователю и возвращает открытый текст.
    Вызывается из Celery-задачи (см. users/tasks.py): и генерация, и отправка письма
    живут в воркере, чтобы открытый пароль не проходил через брокер задач.
    """
    new_password = generate_password()
    user.set_password(new_password)
    user.save()
    return new_password


def send_password_email(email: str, user_name: str, new_password: str) -> None:
    """Отправляет письмо с новым временным паролем. Вызывается из Celery-задачи."""
    subject = "Ваш новый пароль для входа на сайт portfolio.bgitu.ru"
    message = f"Уважаемый(ая) {user_name}! Ваш новый пароль для входа на сайт: {new_password}"

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )


def get_pending_docs_count(user) -> int:
    """
    Возвращает число заявок, ожидающих действия данного сотрудника.

    Логика повторяет правила области видимости (scope):
    - ректорат — все документы со статусом 'approved'
    - декан — 'approved' в рамках своего факультета
    - кафедра — 'pending' в рамках своей кафедры

    Для не-сотрудников (или например сотрудников без привязки) возвращает 0.
    """
    staff = getattr(user, 'staff_profile', None)
    if staff is None:
        return 0

    if getattr(user, 'is_rectorate', False):
        return Document.objects.filter(status__code='approved').count()

    if getattr(user, 'is_dean', False) and staff.faculty_id:
        return Document.objects.filter(
            user__student_profile__faculty_id=staff.faculty_id,
            status__code='approved',
        ).count()

    if getattr(user, 'is_dept_staff', False) and staff.department_id:
        return Document.objects.filter(
            user__student_profile__department_id=staff.department_id,
            status__code='pending',
        ).count()

    return 0

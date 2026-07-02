from django.core.mail import send_mail
from django.conf import settings
from core.admin_password_generator import generate_password


def reset_user_password(user) -> str:
    """
    Генерирует новый временный пароль, сохраняет его пользователю и возвращает открытый текст.
    Сама отправка письма вынесена в Celery-задачу (см. users/tasks.py), чтобы не блокировать HTTP-запрос ожиданием SMTP.
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

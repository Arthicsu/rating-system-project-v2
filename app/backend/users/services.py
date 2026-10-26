import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.db import transaction
from django.utils.html import escape

from core.admin_password_generator import generate_password
from core.querysets import allowed_students
from students.models import Document
from university_structure.models import AcademicYear

logger = logging.getLogger(__name__)

PASSWORD_EMAIL_SUBJECT = "Пароль для входа в Портфолио БГИТУ"
ARCHIVED_EMAIL_SUBJECT = "Портфолио БГИТУ: аккаунт в архиве"
PASSWORD_CHANGED_EMAIL_SUBJECT = "Портфолио БГИТУ: пароль изменён"


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


def is_active_student(user) -> bool:
    """Студент, которому можно выдать пароль: профиль есть, не в архиве, вход не заблокирован."""
    student = getattr(user, 'student_profile', None)
    return student is not None and student.archived_at is None and user.is_active


def find_student_by_email(email: str):
    """
    Пользователь-студент по почте без учёта регистра (почтовые сервисы его не различают).
    Ровно одно совпадение - иначе None: при дубле письмо ушло бы в ящик, к которому
    привязаны два аккаунта, поэтому такие случаи разбирает ОИ (в лог - id, без почты).
    """
    matches = list(
        get_user_model().objects
        .filter(student_profile__isnull=False, email__iexact=email.strip())
        .select_related('student_profile')[:2]
    )
    if len(matches) > 1:
        logger.warning(
            "password request: email matches several students (user ids %s), nothing sent",
            [u.pk for u in matches],
        )
        return None
    return matches[0] if matches else None


def resolve_login_username(raw: str) -> str:
    """
    Логин для authenticate(): точное совпадение username важнее всего; иначе, если
    введена почта, - username единственного активного студента с такой почтой без
    учёта регистра. Неоднозначные и чужие почты остаются как есть (вход не пройдёт).
    """
    if '@' not in raw or get_user_model().objects.filter(username=raw).exists():
        return raw
    user = find_student_by_email(raw)
    return user.username if user is not None and is_active_student(user) else raw


def request_password(email: str) -> None:
    """
    «Получить пароль»: первый вход и «забыл пароль» одним сценарием, только для студентов.

    Активному студенту в очередь уходит генерация пароля и письмо, архивному - письмо
    «аккаунт в архиве». Сотрудникам, неизвестным и неоднозначным почтам - ничего.
    Вызывающий всегда отвечает одинаково, поэтому ошибки очереди здесь не пробрасываются:
    500 только для существующей почты раскрыл бы, что аккаунт есть.
    """
    from .tasks import send_archived_account_email, send_recovery_password_email

    user = find_student_by_email(email)
    if user is None:
        return

    # Кулдаун на аккаунт: почту нельзя засыпать письмами, а пароль - сбрасывать без конца.
    if not cache.add(f"pwd-request:{user.pk}", 1, settings.PASSWORD_REQUEST_COOLDOWN):
        return

    task = send_recovery_password_email if is_active_student(user) else send_archived_account_email
    try:
        task.delay(user.pk)
    except Exception:
        logger.exception("password request: cannot queue %s for user id=%s", task.name, user.pk)


def _greeting(user_name: str) -> str:
    # Без ФИО в базе - без пустого обращения «Здравствуйте, !».
    return f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"


def _send_email(email: str, subject: str, text: str) -> None:
    """Письмо plain text + простая HTML-версия того же текста."""
    html = "<br>".join(escape(line) for line in text.splitlines())
    message = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [email])
    message.attach_alternative(f'<p style="font-family:sans-serif">{html}</p>', "text/html")
    message.send(fail_silently=False)


def send_password_email(email: str, user_name: str, login: str, new_password: str) -> None:
    """Письмо с паролем для входа. Вызывается из Celery-задачи."""
    site = f"Сайт: {settings.EXTERNAL_SITE_URL}\n" if settings.EXTERNAL_SITE_URL else ""
    text = (
        f"{_greeting(user_name)}\n"
        "\n"
        "Данные для входа в Портфолио БГИТУ:\n"
        f"Логин: {login}\n"
        f"Пароль: {new_password}\n"
        f"{site}"
        "\n"
        "Если вы не запрашивали пароль - просто проигнорируйте это письмо.\n"
        "Пароль можно получить повторно на странице входа."
    )
    _send_email(email, PASSWORD_EMAIL_SUBJECT, text)


def send_archived_notice_email(email: str, user_name: str) -> None:
    """Письмо архивному студенту вместо пароля. Вызывается из Celery-задачи."""
    text = (
        f"{_greeting(user_name)}\n"
        "\n"
        "Ваш аккаунт в Портфолио БГИТУ находится в архиве, поэтому пароль для входа не выдаётся.\n"
        "Если это ошибка - обратитесь в отдел информатизации."
    )
    _send_email(email, ARCHIVED_EMAIL_SUBJECT, text)


def send_password_changed_notice_email(email: str, user_name: str) -> None:
    """Уведомление о смене пароля самим студентом (пароля в письме нет). Вызывается из Celery-задачи."""
    site = f"Сайт: {settings.EXTERNAL_SITE_URL}\n" if settings.EXTERNAL_SITE_URL else ""
    text = (
        f"{_greeting(user_name)}\n"
        "\n"
        "Пароль от Портфолио БГИТУ изменён.\n"
        "Если это были не вы - получите новый пароль на странице входа («Восстановить пароль»).\n"
        f"{site}"
    )
    _send_email(email, PASSWORD_CHANGED_EMAIL_SUBJECT, text)


def get_pending_docs_count(user) -> int:
    """
    Возвращает число заявок, ожидающих действия данного сотрудника.

    Область видимости и статусы — те же, что у списка заявок на дашборде
    (core/querysets.pending_documents): кафедра считает 'pending', декан и
    ректорат — 'approved', студенты берутся из allowed_students (активные,
    scope по цепочке группа -> специальность -> кафедра).

    Для не-сотрудников возвращает 0.
    """
    if not hasattr(user, 'staff_profile'):
        return 0

    doc_status = 'approved' if user.is_leadership else 'pending'
    # Текущий семестр, как вкладка кабинета по умолчанию: иначе шапка и вкладка расходятся,
    # а заявки прошлых лет навсегда накручивают счётчик (их разбор — задача 7.9).
    current = AcademicYear.get_current()
    return Document.objects.filter(
        user__student_profile__in=allowed_students(user),
        status__code=doc_status,
        **({'semester': current} if current else {}),
    ).count()

"""
Хелперы построения querysets и агрегатов (замена core/students_query_set_mixin).

Параметрические фильтры (faculty_id / course / group_id) и поиск обрабатываются
filter backends на уровне ViewSet (core/filters.py + SearchFilter). Здесь живёт
то, что на django-filter не ложится: scope-фильтрация, выбор периода (учебный год или
семестр) с аннотациями истории, агрегаты дашборда и сборка полного профиля студента.
"""
from typing import NamedTuple

from django.contrib.auth.models import Group as AuthGroup
from django.db.models import Avg, Count, IntegerField, Max, Min, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from core import scoping
from core.students_manager import CATEGORY_SCORE_FIELDS
from students.models import Category, Document, SemesterScore, Student
from university_structure.models import AcademicYear


# --- Период: учебный год или семестр ---------------------------------------

class Period(NamedTuple):
    """
    Выбранный период. semester_ids - его семестры (None - без ограничения: в базе нет ни
    одного семестра); is_live - баллы из живого кэша Student (текущий учебный год целиком),
    иначе - суммы SemesterScore по semester_ids; label - подпись для Excel; year_start -
    учебный год, если выбран год целиком (None для одного семестра).
    """
    semester_ids: list | None
    is_live: bool
    label: str
    year_start: int | None = None


def _year_label(year_start):
    return f"{year_start}-{year_start + 1} уч. год"


def _int_param(request, *names):
    """Первый числовой параметр из names; нечисловой - как не переданный (иначе 500 на фильтре)."""
    for name in names:
        value = request.query_params.get(name)
        if value and str(value).isdigit():
            return int(value)
    return None


def get_requested_period(request):
    """
    Период для списков, статистики и экспорта кабинета.

    `academic_year` (синоним `semester`) - id одного семестра, баллы из истории (даже у семестра
    текущего года); `year_start` - учебный год целиком; без параметров - текущий учебный год.
    Текущий учебный год целиком (явно или по умолчанию) читается из живого кэша Student.
    """
    current = AcademicYear.get_current()
    semester_id = _int_param(request, 'academic_year', 'semester')
    if semester_id is not None:
        semester = AcademicYear.objects.filter(pk=semester_id).first()
        return Period([semester_id], False, semester.label if semester else '')

    year_start = _int_param(request, 'year_start')
    if year_start is None:
        if current is None:
            return Period(None, True, '')
        year_start = current.year_start
    ids = list(AcademicYear.year_semesters(year_start).values_list('pk', flat=True))
    is_live = current is not None and current.year_start == year_start
    return Period(ids, is_live, _year_label(year_start), year_start)


def semester_breakdown(students, year_start):
    """
    Баллы студентов по семестрам учебного года для листа Excel «По семестрам»:
    [(подпись семестра, {student_id: {поле: балл}})], семестры по порядку (осень, весна).
    """
    student_ids = list(students.values_list('pk', flat=True))
    breakdown = []
    for semester in AcademicYear.year_semesters(year_start):
        rows = SemesterScore.objects.filter(semester=semester, student_id__in=student_ids).values(
            'student_id', *CATEGORY_SCORE_FIELDS,
        )
        breakdown.append((semester.label, {row['student_id']: row for row in rows}))
    return breakdown


def requested_period_filter(request):
    """Фильтр-словарь по периоду для Document (по умолчанию - текущий учебный год)."""
    ids = get_requested_period(request).semester_ids
    return {} if ids is None else {'semester_id__in': ids}


def period_score_annotations(semester_ids):
    """
    Баллы за семестры периода для queryset `Student`: по коррелированному подзапросу-сумме
    SemesterScore на категорию и итог, 0 у студентов без строк. Позволяет показывать ВСЕХ
    отфильтрованных студентов за прошлый период. Ключи: `sem_<code>_score`, `sem_total_score`.

    Набор полей фиксирован (CATEGORY_SCORE_FIELDS), а не берётся из таблицы Category:
    сериализаторы и Excel-экспорт ожидают все пять sem_*-полей.
    """
    rows = (
        SemesterScore.objects.filter(student=OuterRef('pk'), semester_id__in=semester_ids)
        .order_by().values('student')
    )
    annotations = {}
    for field in (*CATEGORY_SCORE_FIELDS, 'total_score'):
        annotations[f'sem_{field}'] = Coalesce(
            Subquery(rows.annotate(points=Sum(field)).values('points')[:1], output_field=IntegerField()),
            Value(0),
        )
    return annotations


def get_requested_semester(request):
    """
    НЕ ЗАДЕЙСТВОВАНО: заменено get_requested_period / period_score_annotations (решение 2026-10-21).

    (semester_id, is_past) для представлений с выбором семестра.

    Основной параметр — `academic_year`, поддерживается и `semester`.
    Без параметра — текущий семестр (is_past=False). is_past=True только когда
    запрошен НЕ текущий семестр: тогда баллы читаются из истории SemesterScore,
    иначе — из живого кэша Student.
    """
    semester_id = request.query_params.get('academic_year') or request.query_params.get('semester')
    # Нечисловое значение молча приравниваем к «параметр не передан», иначе
    # фильтр по semester_id уронит запрос на этапе выполнения (500).
    if semester_id and not str(semester_id).isdigit():
        semester_id = None
    current = AcademicYear.get_current()
    if not semester_id:
        return (current.id if current else None), False
    is_past = not (current is not None and str(current.id) == str(semester_id))
    return semester_id, is_past


def requested_semester_filter(request):
    """
    НЕ ЗАДЕЙСТВОВАНО: заменено requested_period_filter (решение 2026-10-21).

    Фильтр-словарь по семестру для Document (по умолчанию — текущий семестр).
    """
    semester_id, _ = get_requested_semester(request)
    return {'semester_id': semester_id} if semester_id else {}


def semester_score_annotations(semester_id):
    """
    НЕ ЗАДЕЙСТВОВАНО: заменено period_score_annotations (решение 2026-10-21).

    Аннотации баллов выбранного семестра для queryset `Student` (по одному
    коррелированному подзапросу на категорию + итог), с дефолтом 0. Позволяет
    показывать ВСЕХ отфильтрованных студентов за прошлый семестр (0 у тех, у
    кого нет строки SemesterScore). Ключи: `sem_<code>_score`, `sem_total_score`.

    Набор полей фиксирован (CATEGORY_SCORE_FIELDS), а не берётся из таблицы
    Category: сериализаторы и Excel-экспорт ожидают все пять sem_*-полей.
    """
    base = SemesterScore.objects.filter(student=OuterRef('pk'), semester_id=semester_id)
    annotations = {}
    for field in CATEGORY_SCORE_FIELDS:
        annotations[f'sem_{field}'] = Coalesce(
            Subquery(base.values(field)[:1], output_field=IntegerField()), Value(0)
        )
    annotations['sem_total_score'] = Coalesce(
        Subquery(base.values('total_score')[:1], output_field=IntegerField()), Value(0)
    )
    return annotations


# --- Студенты ---------------------------------------------------------------

def allowed_students(user):
    """
    Активные студенты в области видимости сотрудника (без параметрических
    фильтров — их применяет DjangoFilterBackend на уровне ViewSet).
    """
    queryset = Student.objects.active().select_related(
        'group__specialty__faculty', 'faculty', 'user'
    ).order_by('user__last_name', 'user__first_name')

    if not hasattr(user, 'staff_profile'):
        return queryset.none()

    return scoping.scope_queryset(user, queryset)


def filtered_students(user, request):
    """
    Студенты в scope с применёнными фильтрами кабинета (факультет/курс/группа) —
    для агрегатов дашборда (stats, top5), которые считаются по Student, а не по
    Document, и потому не могут переиспользовать filter backends вьюшки списка заявок.

    Поиск (search) сюда не входит: он ищет карточки в списке заявок (в т.ч. по названию),
    а статистика не должна обнуляться оттого, что сотрудник что-то ищет.
    """
    from core.filters import StudentFilterSet

    return StudentFilterSet(
        request.query_params, queryset=allowed_students(user), request=request
    ).qs


def rating_queryset(request):
    """
    Базовый queryset рейтинга за выбранный период (только активные студенты
    в области видимости сотрудника: кафедра - своя, декан - факультет, ректорат - все).

    Текущий учебный год (по умолчанию) — живой кэш баллов Student; прошлый год или
    отдельный семестр — аннотации sem_* из истории SemesterScore (0 у студентов без строк).
    Сортировка — по категории из `category`, направление — `direction`
    (asc|desc, по умолчанию desc).
    """
    category = request.query_params.get('category', 'common')
    direction = request.query_params.get('direction', 'desc')

    # Без scope кафедра видела в таблице весь вуз (а профили чужих не открывались).
    queryset = scoping.scope_queryset(
        request.user, Student.objects.active().select_related('group', 'faculty', 'user')
    )

    period = get_requested_period(request)
    prefix = ''
    if not period.is_live:
        queryset = queryset.annotate(**period_score_annotations(period.semester_ids))
        prefix = 'sem_'

    return queryset.by_category(category, direction=direction, prefix=prefix)


# --- Профиль студента -------------------------------------------------------

def student_radar_data(student):
    """Данные радарной диаграммы: метки категорий и баллы студента по ним."""
    labels = []
    values = []
    for category in Category.objects.all():
        labels.append(category.label)
        values.append(getattr(student, f"{category.code}_score", 0))
    return {"labels": labels, "data": values}


def student_full_profile(student, request, is_own_profile=False):
    """
    Полные данные профиля студента: StudentProfileSerializer + radar_stats +
    is_own_profile. Контакты (email/phone) видны владельцу и сотрудникам.
    """
    from students.serializers import StudentProfileSerializer

    data = StudentProfileSerializer(student, context={'request': request}).data
    data["radar_stats"] = student_radar_data(student)
    data["is_own_profile"] = is_own_profile

    if is_own_profile or (request.user.group_names & {'Department', 'Dean', 'Rectorate'}):
        data["email"] = student.email
        data["phone"] = getattr(student, 'phone', None)

    return data


# --- Дашборд сотрудника -----------------------------------------------------

def _stats_aggregates(category_codes, score_prefix=''):
    """
    Агрегаты статистики; per-category суммы под ключом '<code>_sum'.
    `score_prefix`='sem_' переключает на аннотации прошлого периода.
    """
    aggregates = {
        'total_students': Count('id'),
        'avg_score': Avg(f'{score_prefix}total_score'),
        'max_score': Max(f'{score_prefix}total_score'),
        'min_score': Min(f'{score_prefix}total_score'),
    }
    for code in category_codes:
        aggregates[f'{code}_sum'] = Sum(f'{score_prefix}{code}_score')
    return aggregates


def dashboard_stats(user, request):
    """
    Статистика по отфильтрованным студентам за выбранный период.

    Текущий учебный год — живой кэш Student; прошлый период — аннотации баллов поверх
    ВСЕГО отфильтрованного списка (0 у тех, у кого нет истории), чтобы состав и
    статистика совпадали с текущим годом.
    """
    students = filtered_students(user, request)
    period = get_requested_period(request)
    category_codes = list(Category.objects.values_list('code', flat=True))

    if not period.is_live:
        source = students.annotate(**period_score_annotations(period.semester_ids))
        aggregates = _stats_aggregates(category_codes, score_prefix='sem_')
    else:
        source = students
        aggregates = _stats_aggregates(category_codes)

    stats_data = source.aggregate(**aggregates)

    return {
        'total_students': stats_data['total_students'] or 0,
        'avg_score': round(stats_data['avg_score'] or 0, 2),
        'max_score': stats_data['max_score'] or 0,
        'min_score': stats_data['min_score'] or 0,
        'categories': {code: (stats_data[f'{code}_sum'] or 0) for code in category_codes},
        'moderation': _moderation_stats(students, request),
    }


def _moderation_stats(students, request):
    """
    Показатели модерации за выбранный период по тем же студентам, что и остальная
    статистика, одним запросом: подано, одобрено, отклонено, ждут решения кафедры,
    из них повторных/возвращённых (с причиной) и сколько дней ждёт самая старая.
    """
    pending = Q(status__code='pending')
    data = Document.objects.filter(
        user__student_profile__in=students, **requested_period_filter(request)
    ).aggregate(
        submitted=Count('id'),
        approved=Count('id', filter=Q(status__code='approved')),
        rejected=Count('id', filter=Q(status__code='rejected')),
        pending=Count('id', filter=pending),
        returned=Count('id', filter=pending & Q(rejection_reason__gt='')),
        oldest_pending=Min('uploaded_at', filter=pending),
    )
    oldest = data.pop('oldest_pending')
    data['oldest_pending_days'] = (timezone.now() - oldest).days if oldest else None
    return data


def top5_students(user, request):
    """
    Топ-5 студентов за выбранный период (по сумме баллов) среди
    отфильтрованных. Контракт строки: {id, full_name, total_score}.
    """
    students = filtered_students(user, request)
    period = get_requested_period(request)

    if not period.is_live:
        top = (
            students.annotate(**period_score_annotations(period.semester_ids))
            .order_by('-sem_total_score', 'full_name')[:5]
        )
        return [
            {'id': s.id, 'full_name': s.full_name, 'total_score': s.sem_total_score}
            for s in top
        ]

    top = students.order_by('-total_score')[:5]
    return [
        {'id': s.id, 'full_name': s.full_name, 'total_score': s.total_score}
        for s in top
    ]


_DOCUMENT_LIST_RELATED = (
    'user__student_profile',
    'user__student_profile__group',
    'status', 'category', 'sub_type', 'level', 'result', 'doc_type', 'semester',
)


def returned_by_annotation():
    """
    Метка «Возвращена деканатом/ректоратом» (Dean/Rectorate или None): последнее решение по
    заявке принял руководитель (повторная подача студента сбрасывает verified_by).
    Смысл имеет только у заявки на рассмотрении — по статусу проверяет клиент.
    """
    return Subquery(
        AuthGroup.objects.filter(user=OuterRef('verified_by'), name__in=('Dean', 'Rectorate'))
        .order_by('-name').values('name')[:1]  # Rectorate раньше Dean - самая широкая роль
    )


def pending_documents(user, request):
    """
    Заявки, ожидающие действия сотрудника, в его области видимости:
    кафедра видит 'pending', декан/ректорат — 'approved' (на утверждение).
    Параметрические фильтры и поиск применяет ViewSet (filter backends).
    """
    doc_status = 'approved' if user.is_leadership else 'pending'
    return (
        Document.objects.filter(
            user__student_profile__in=allowed_students(user),
            status__code=doc_status,
            **requested_period_filter(request),
        )
        .select_related(*_DOCUMENT_LIST_RELATED)
        .prefetch_related('files')
        .annotate(returned_by=returned_by_annotation())
        # Очередь — сначала старые: дольше всех ждут первыми, а новые уходят в конец и не
        # сдвигают первую страницу под курсором при фоновом обновлении. Добор по id: у пачки
        # заявок с одинаковым uploaded_at порядок иначе не определён, и страницы перекрываются.
        # shortcut: ключ — дата первой подачи (другой даты у заявки нет): повторно поданная или
        # возвращённая руководством встаёт в начало, а в очереди руководства подтверждённые
        # встают по дате подачи студентом; если это мешает — поле «в очереди с» при смене статуса.
        .order_by('uploaded_at', 'id')
    )


def reviewed_documents(user, request):
    """Заявки с финальным решением (approved/rejected) в области видимости сотрудника."""
    return (
        Document.objects.filter(
            user__student_profile__in=allowed_students(user),
            status__code__in=['approved', 'rejected'],
            **requested_period_filter(request),
        )
        .select_related(*_DOCUMENT_LIST_RELATED)
        .prefetch_related('files')
        .order_by('-uploaded_at', '-id')
    )

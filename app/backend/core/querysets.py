"""
Хелперы построения querysets и агрегатов (замена core/students_query_set_mixin).

Параметрические фильтры (faculty_id / course / group_id) и поиск обрабатываются
filter backends на уровне ViewSet (core/filters.py + SearchFilter). Здесь живёт
то, что на django-filter не ложится: scope-фильтрация, выбор семестра с
аннотациями истории, агрегаты дашборда и сборка полного профиля студента.
"""
from django.db.models import Avg, Count, IntegerField, Max, Min, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from core import scoping
from core.students_manager import CATEGORY_SCORE_FIELDS
from students.models import Category, Document, SemesterScore, Student
from university_structure.models import AcademicYear


# --- Семестры ---------------------------------------------------------------

def get_requested_semester(request):
    """
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
    """Фильтр-словарь по семестру для Document (по умолчанию — текущий семестр)."""
    semester_id, _ = get_requested_semester(request)
    return {'semester_id': semester_id} if semester_id else {}


def semester_score_annotations(semester_id):
    """
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
    Студенты в scope с применёнными параметрами запроса (факультет/курс/группа
    и поиск) — для агрегатов дашборда (stats, top5), которые считаются по
    Student, а не по Document, и потому не могут переиспользовать filter
    backends вьюшки списка заявок.
    """
    from core.filters import StudentFilterSet

    queryset = StudentFilterSet(
        request.query_params, queryset=allowed_students(user), request=request
    ).qs

    search = request.query_params.get('search')
    if search:
        queryset = queryset.filter(
            Q(full_name__icontains=search) | Q(record_book__icontains=search)
        )
    return queryset


def rating_queryset(request):
    """
    Базовый queryset рейтинга за выбранный семестр (только активные студенты).

    Текущий семестр (по умолчанию) — живой кэш баллов Student; прошлый —
    аннотации sem_* из истории SemesterScore (0 у студентов без строки).
    Сортировка — по категории из `category`, направление — `direction`
    (asc|desc, по умолчанию desc).
    """
    category = request.query_params.get('category', 'common')
    direction = request.query_params.get('direction', 'desc')

    queryset = Student.objects.active().select_related('group', 'faculty', 'user')

    semester_id, is_past = get_requested_semester(request)
    prefix = ''
    if is_past and semester_id:
        queryset = queryset.annotate(**semester_score_annotations(semester_id))
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
    `score_prefix`='sem_' переключает на аннотации прошлого семестра.
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
    Статистика по отфильтрованным студентам за выбранный семестр.

    Текущий семестр — живой кэш Student; прошлый — аннотации баллов семестра
    поверх ВСЕГО отфильтрованного списка (0 у тех, у кого нет истории), чтобы
    состав и статистика совпадали с текущим семестром.
    """
    students = filtered_students(user, request)
    semester_id, is_past = get_requested_semester(request)
    category_codes = list(Category.objects.values_list('code', flat=True))

    if is_past and semester_id:
        source = students.annotate(**semester_score_annotations(semester_id))
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
    }


def top5_students(user, request):
    """
    Топ-5 студентов за выбранный семестр (по сумме баллов) среди
    отфильтрованных. Контракт строки: {id, full_name, total_score}.
    """
    students = filtered_students(user, request)
    semester_id, is_past = get_requested_semester(request)

    if is_past and semester_id:
        top = (
            students.annotate(**semester_score_annotations(semester_id))
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
    'status', 'category', 'sub_type', 'level', 'result', 'doc_type',
)


def pending_documents(user, request):
    """
    Заявки, ожидающие действия сотрудника, в его области видимости:
    кафедра видит 'pending', декан/ректорат — 'approved' (на утверждение).
    Параметрические фильтры и поиск применяет ViewSet (filter backends).
    """
    doc_status = 'pending' if user.is_dept_staff else 'approved'
    return (
        Document.objects.filter(
            user__student_profile__in=allowed_students(user),
            status__code=doc_status,
            **requested_semester_filter(request),
        )
        .select_related(*_DOCUMENT_LIST_RELATED)
        .prefetch_related('files')
        # Добор по -id: у пачки заявок с одинаковым uploaded_at порядок иначе
        # не определён, и страницы пагинации перекрываются (одни и те же карточки).
        .order_by('-uploaded_at', '-id')
    )


def reviewed_documents(user, request):
    """Заявки с финальным решением (approved/rejected) в области видимости сотрудника."""
    return (
        Document.objects.filter(
            user__student_profile__in=allowed_students(user),
            status__code__in=['approved', 'rejected'],
            **requested_semester_filter(request),
        )
        .select_related(*_DOCUMENT_LIST_RELATED)
        .prefetch_related('files')
        .order_by('-uploaded_at', '-id')
    )

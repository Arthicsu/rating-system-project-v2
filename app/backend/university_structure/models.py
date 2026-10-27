from django.db import models
from datetime import date

from django.core.exceptions import ValidationError
from django.db.models import Q
from django.conf import settings

class Faculty(models.Model):
    external_id = models.CharField("Код факультета", max_length=50, unique=True, help_text="Код факультета из БД вуза")
    name = models.CharField("Название факультета", max_length=255, unique=True)
    short_name = models.CharField("Сокращение", max_length=20, unique=True)
    alias = models.CharField("Псевдоним", max_length=100, blank=True, null=True)
    dean_name = models.CharField("Декан", max_length=255, blank=True, null=True)
    phone = models.CharField("Телефон", max_length=20, blank=True, null=True)
    email = models.EmailField("Email", blank=True, null=True)
    subdivision_type = models.CharField("Институт/Филиал/Подразделение", max_length=255, blank=True, null=True)

    def __str__(self) -> str:
        return self.short_name

    class Meta:
        verbose_name = "Факультет"
        verbose_name_plural = "Факультеты"

class Department(models.Model):
    external_id = models.CharField("Код кафедры", max_length=50, unique=True, help_text="Код кафедры из БД вуза")
    name = models.CharField("Название кафедры", max_length=255, unique=True)
    short_name = models.CharField("Сокращение", max_length=20, unique=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='departments', null=True, blank=True, verbose_name="Факультет")
    phone = models.CharField("Телефон", max_length=20, blank=True, null=True)
    head_name = models.CharField("Зав. кафедрой", max_length=255, blank=True)
    status = models.PositiveIntegerField(default=0, null=True)
    
    def __str__(self) -> str:
        return self.short_name

    class Meta:
        verbose_name= "Кафедра"
        verbose_name_plural = "Кафедры"

class Specialty(models.Model):
    external_id = models.CharField("Код специальности", max_length=50, unique=True, help_text="Код специальности из БД вуза")
    code_fgos = models.CharField("Код по ФГОС", max_length=20)
    name = models.CharField("Название специальности", max_length=255)
    short_name = models.CharField("Краткое название", max_length=100, blank=True, null=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, verbose_name="Факультет")
    department = models.ForeignKey(Department, on_delete=models.CASCADE, verbose_name="Кафедра")
    qualification = models.CharField("Квалификация", max_length=100, blank=True, null=True)
    specialty_type = models.CharField("Специальность", max_length=255, blank=True, null=True)
    prefix = models.CharField("Префикс", max_length=20, blank=True, null=True)
    parent_code = models.CharField("КодРодителя", max_length=50, blank=True, null=True)
    
    def __str__(self):
        return self.name or f"Специальность {self.code_fgos or 'Без названия'}"

    class Meta:
        verbose_name = "Специальность"
        verbose_name_plural = "Специальности"

class Group(models.Model):
    external_id = models.CharField("Код группы", max_length=50, unique=True, help_text="Код группы из БД вуза")
    name = models.CharField("Название группы", max_length=50)
    specialty = models.ForeignKey(Specialty, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Специальность")
    course = models.PositiveSmallIntegerField("Курс")
    academic_year = models.CharField("Учебный год", max_length=20)
    education_duration = models.CharField("Срок обучения", max_length=50, blank=True, null=True)
    education_level = models.CharField("Уровень", max_length=5)
    education_level_decode = models.CharField("Название уровеня", max_length=100)
    education_form = models.CharField("Форма обучения", max_length=5)
    education_form_decode = models.CharField("Название формы обучения", max_length=100)
    status = models.PositiveIntegerField(default=0, null=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Группа"
        verbose_name_plural = "Группы"
        indexes = [
            models.Index(fields=['course', 'name']),
            models.Index(fields=['academic_year']),
        ]

class Staff(models.Model):
    """
    Модель сотрудника университета. Позже распишу что и как (мне пока лень)
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile')
    email = models.EmailField("Email", blank=True, null=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='staff', null=True, blank=True, verbose_name="Кафедра")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='staff', null=True, blank=True, verbose_name="Факультет")
    phone = models.CharField("Телефон", max_length=20, null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.get_full_username()}"

    class Meta:
        verbose_name = "Сотрудник"
        verbose_name_plural = "Сотрудники"
        indexes = [
            models.Index(fields=['department', 'faculty']),
        ]

class RejectionReason(models.Model):
    text = models.CharField("Текст причины", max_length=255, unique=True)
    is_active = models.BooleanField("Активна", default=True, help_text="Если снять галочку, причина не будет предлагаться при новых отказах")

    def __str__(self) -> str:
        return self.text

    class Meta:
        verbose_name = "Причина отказа"
        verbose_name_plural = "Причины отказа"

class AcademicYear(models.Model):
    """
    Учебный период = семестр: пара (учебный год, осень/весна), например
    «2025-2026 уч. год — осень». Подпись собирается при сохранении, даты по умолчанию
    берутся из settings.SEMESTER_TEMPLATE. Флаг is_current помечает текущий учебный год
    (его живой рейтинг); одновременно текущим может быть только один период.
    """
    TERM_CHOICES = [('autumn', 'осень'), ('spring', 'весна')]

    label = models.CharField("Название периода", max_length=100, editable=False)
    year_start = models.PositiveSmallIntegerField(
        "Учебный год (год начала)", blank=True,
        help_text="2025 - для 2025-2026 учебного года. Пусто - по дате начала.",
    )
    term = models.CharField(
        "Семестр", max_length=6, choices=TERM_CHOICES, blank=True, help_text="Пусто - по дате начала.",
    )
    start_date = models.DateField("Дата начала", blank=True, help_text="Пусто - по шаблону: осень с 01.09, весна с 01.02.")
    end_date = models.DateField("Дата окончания", blank=True, help_text="Пусто - по шаблону: осень по 31.01, весна по 31.08.")
    is_current = models.BooleanField("Текущий семестр", default=False)

    @classmethod
    def get_current(cls):
        """Активный (текущий) семестр или None, если ни один не помечен."""
        return cls.objects.filter(is_current=True).first()

    @staticmethod
    def infer_year_term(start_date):
        """Учебный год и семестр по дате начала: с августа - осень этого года, иначе весна прошлого."""
        return (start_date.year, 'autumn') if start_date.month >= 8 else (start_date.year - 1, 'spring')

    @classmethod
    def template_dates(cls, year_start, term):
        """Даты семестра по шаблону; конец раньше начала по календарю - значит, в следующем году."""
        (start_month, start_day), (end_month, end_day) = settings.SEMESTER_TEMPLATE[term]
        start_year = year_start if term == 'autumn' else year_start + 1
        end_year = start_year + 1 if (end_month, end_day) < (start_month, start_day) else start_year
        return date(start_year, start_month, start_day), date(end_year, end_month, end_day)

    @classmethod
    def year_semesters(cls, year_start):
        """Семестры учебного года по порядку: осень, весна."""
        return cls.objects.filter(year_start=year_start).order_by('start_date')

    @classmethod
    def semester_for_date(cls, day):
        """
        Семестр, к которому относится дата достижения: заведённый семестр, в чьи даты она
        попадает. До перехода на новый год продолжается старый: семестры следующих лет (даже
        заведённые заранее) не учитываются, а дата позже конца текущего учебного года относится
        к его последнему семестру. Иначе None.
        """
        current = cls.get_current()
        semesters = cls.objects.all() if current is None else cls.objects.filter(year_start__lte=current.year_start)
        found = semesters.filter(start_date__lte=day, end_date__gte=day).first()
        if found is not None or current is None:
            return found
        last = cls.year_semesters(current.year_start).last()
        return last if day > last.end_date else None

    def _fill_from_template(self):
        """Учебный год и семестр - из даты начала, если не заданы; пустые даты - по шаблону."""
        start_field, end_field = self._meta.get_field('start_date'), self._meta.get_field('end_date')
        self.start_date = start_field.to_python(self.start_date)
        self.end_date = end_field.to_python(self.end_date)
        if self.year_start is None or not self.term:
            if self.start_date is None:
                raise ValidationError("Укажите учебный год и семестр или дату начала.")
            self.year_start, self.term = self.infer_year_term(self.start_date)
        template_start, template_end = self.template_dates(self.year_start, self.term)
        self.start_date = self.start_date or template_start
        self.end_date = self.end_date or template_end
        self.label = f"{self.year_start}-{self.year_start + 1} уч. год — {self.get_term_display()}"

    def clean(self):
        # До проверки уникальности (год, семестр): иначе выведенный из даты дубль упал бы в save().
        self._fill_from_template()

    def save(self, *args, **kwargs):
        self._fill_from_template()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.label

    class Meta:
        verbose_name = "Учебный период"
        verbose_name_plural = "Учебные периоды"
        ordering = ['-start_date']
        constraints = [
            models.UniqueConstraint(
                fields=['is_current'],
                condition=Q(is_current=True),
                name='only_one_current_period',
            ),
            models.UniqueConstraint(fields=['year_start', 'term'], name='uniq_academic_year_term'),
        ]
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['is_current']),
        ]
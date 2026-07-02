from django.db import models
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

class Group(models.Model):
    external_id = models.CharField("Код группы", max_length=50, unique=True, help_text="Код группы из БД вуза")
    name = models.CharField("Название группы", max_length=50)
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, related_name='groups', null=True, blank=True, verbose_name="Факультет")
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
    label = models.CharField("Название периода", max_length=100)
    start_date = models.DateField("Дата начала")
    end_date = models.DateField("Дата окончания")
    is_current = models.BooleanField("Текущий семестр", default=False)

    def __str__(self):
        return self.label

    class Meta:
        verbose_name = "Учебный период"
        verbose_name_plural = "Учебные периоды"
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['is_current']),
        ]
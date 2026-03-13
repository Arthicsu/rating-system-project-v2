from django.db import models
from django.conf import settings

class Faculty(models.Model):
    external_id = models.CharField("Код факультета", max_length=50, unique=True)
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
    external_id = models.CharField("Код кафедры", max_length=50, unique=True)
    name = models.CharField("Название кафедры", max_length=255, unique=True)
    short_name = models.CharField("Сокращение", max_length=20, unique=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='departments', null=True, blank=True, verbose_name="Факультет")
    head_name = models.CharField("Зав. кафедрой", max_length=255, blank=True)

    def __str__(self) -> str:
        return self.short_name

    class Meta:
        verbose_name= "Кафедра"
        verbose_name_plural = "Кафедры"

class Specialty(models.Model):
    external_id = models.CharField("Код специальности", max_length=50, unique=True)
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
    external_id = models.CharField("Код группы", max_length=50, unique=True)
    name = models.CharField("Название группы", max_length=50)
    specialty = models.ForeignKey(Specialty, on_delete=models.CASCADE, verbose_name="Специальность")
    course = models.PositiveSmallIntegerField("Курс")
    academic_year = models.CharField("Учебный год", max_length=20)
    education_duration = models.CharField("Срок обучения", max_length=50, blank=True, null=True)
    education_level = models.CharField("Уровень", max_length=100)
    education_form = models.CharField("Форма обучения", max_length=100)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Группа"
        verbose_name_plural = "Группы"

class Staff(models.Model):
    """
    Модель сотрудника университета. Позже распишу что и как (мне пока лень)
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile')

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='staff', null=True, blank=True, verbose_name="Кафедра")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='staff', null=True, blank=True, verbose_name="Факультет")
    phone = models.CharField("Телефон", max_length=20, null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.get_full_username()}"

    class Meta:
        verbose_name = "Сотрудник"
        verbose_name_plural = "Сотрудники"
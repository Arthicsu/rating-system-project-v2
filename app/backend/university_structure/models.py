from django.db import models
from django.conf import settings

class Faculty(models.Model):
    name = models.CharField("Название факультета", max_length=255, unique=True)
    short_name = models.CharField("Сокращение", max_length=20, unique=True)

    def __str__(self) -> str:
        return self.short_name

    class Meta:
        verbose_name = "Факультет"
        verbose_name_plural = "Факультеты"

class Department(models.Model):
    name = models.CharField("Название кафедры", max_length=255, unique=True)
    short_name = models.CharField("Сокращение", max_length=20, unique=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='departments', null=True, blank=True)
    
    def __str__(self) -> str:
        return self.short_name

    class Meta:
        verbose_name= "Кафедра"
        verbose_name_plural = "Кафедры"

class Group(models.Model):    
    name = models.CharField(max_length=50, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='groups', null=True, blank=True)
    course = models.PositiveSmallIntegerField("Курс")
    
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

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='staff', null=True, blank=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='staff', null=True, blank=True)

    def __str__(self):
        return f"{self.user.get_full_username()}"

    class Meta:
        verbose_name = "Сотрудник"
        verbose_name_plural = "Сотрудники"
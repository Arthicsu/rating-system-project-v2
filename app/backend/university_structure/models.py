from django.db import models
from django.conf import settings

class Faculty(models.Model):
    FACULTY_CHOICES = [
        ('EiEB', 'Экономика и экономическая безопасность'),
        ('IT', 'Информационные технологии'),
    ]
    
    name = models.CharField("Название факультета", max_length=255, unique=True)
    short_name = models.CharField("Сокращение", max_length=20, unique=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Факультет"
        verbose_name_plural = "Факультеты"

class Group(models.Model):    
    name = models.CharField(max_length=50, unique=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='groups', null=True, blank=True)
    course = models.PositiveSmallIntegerField()
    curator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='curated_groups')
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Группа"
        verbose_name_plural = "Группы"

class Teacher(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='teacher_profile'
    )
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='teachers', null=True, blank=True)
    phone = models.CharField("Телефон", max_length=20)
    position = models.CharField("Должность", max_length=100, blank=True)

    def __str__(self):
        return f"Преподаватель: {self.user.get_full_username()}"

    class Meta:
        verbose_name = "Профиль преподавателя"
        verbose_name_plural = "Профили преподавателей"

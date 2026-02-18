from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    patronymic = models.CharField("Отчество", max_length=150, blank=True)

    @property
    def is_student(self):
        return self.groups.filter(name='Student').exists()

    @property
    def is_dean(self):
        return self.groups.filter(name='Dean').exists()

    @property
    def is_dept_staff(self):
        return self.groups.filter(name='Department').exists()

    @property
    def is_rectorate(self):
        return self.groups.filter(name='Rectorate').exists()

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return f"{self.last_name} {self.first_name} {self.patronymic}".strip()

    def get_full_username(self):
        full_name = f"{self.last_name} {self.first_name}"
        if self.patronymic:
            full_name += f" {self.patronymic}"
        return full_name.strip()

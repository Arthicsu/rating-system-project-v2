from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    patronymic = models.CharField("Отчество", max_length=150, null=True ,blank=True)

    @property
    def group_names(self):
        if not hasattr(self, '_group_names_cache'):
            self._group_names_cache = set(self.groups.values_list('name', flat=True))
        return self._group_names_cache

    @property
    def is_student(self):
        return 'Student' in self.group_names

    @property
    def is_dean(self):
        return 'Dean' in self.group_names

    @property
    def is_dept_staff(self):
        return 'Department' in self.group_names

    @property
    def is_rectorate(self):
        return 'Rectorate' in self.group_names

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return f"{self.last_name} {self.first_name} {self.patronymic}".strip()

    def get_full_username(self):
        """
        Возвращает полное имя (пока применяем для студента) для отображения на клиенте:
        """
        full_name = f"{self.last_name} {self.first_name}"
        if self.patronymic:
            full_name += f" {self.patronymic}"
        return full_name.strip()

    def get_user_display_name(self):
        """
        Возвращает имя для отображения на клиенте:
        - Студенту: его фио
        - Сотруднику кафедры: сокращённое название кафедры
        - Декану: сокращённое название факультета
        - Ректорату: 'Ректорат'
        """
        if hasattr(self, 'staff_profile'):
            staff = self.staff_profile
            if getattr(self, 'is_dept_staff', False) and staff.department:
                return staff.department.short_name
            elif getattr(self, 'is_dean', False) and staff.faculty:
                return staff.faculty.short_name
            elif getattr(self, 'is_rectorate', False):
                return "Ректорат"
            return "Сотрудник университета"
        return self.get_full_username()

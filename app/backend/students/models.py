from django.db import models
from django.conf import settings
from django.utils import timezone
from university_structure.models import Group, Faculty, Department
from .scoring import calculate_achievement_score, get_choices_from_config

class Student(models.Model):
    """
    Модель профиля студента.

    Связывает пользователя системы с его академическими и внеучебными данными.
    Хранит информацию о студенте, включая личные данные, учебную группу, кафедру, факультет,
    номер зачётной книжки, контактную информацию и баллы по различным направлениям активности.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='student_profile')
    full_name = models.CharField("ФИО", max_length=150)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='students', null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='students', null=True, blank=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='students', null=True, blank=True)  
    record_book = models.CharField("Зачетка", max_length=30, null=True, blank=True)
    phone = models.CharField("Телефон", max_length=20)
    
    academic_score = models.PositiveIntegerField(default=0)
    research_score = models.PositiveIntegerField(default=0)
    sport_score = models.PositiveIntegerField(default=0)
    social_score = models.PositiveIntegerField(default=0)
    cultural_score = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def total_score(self) -> int:
        """
        Вычисляемое свойство: общий рейтинг студента.

        Суммирует все виды баллов студента: академические, научные, спортивные,
        социальные и культурные.

        Возвращает общее количество баллов студента.
        """
        return (
            self.academic_score +
            self.research_score +
            self.sport_score +
            self.social_score +
            self.cultural_score
        )

    class Meta:
        verbose_name = "Профиль студента"
        verbose_name_plural = "Профили студентов"

    def __str__(self):
        group_name = self.group.name if self.group else "Без группы"
        return f"{self.full_name} ({group_name})"


class Document(models.Model):
    """
    Модель документа студента для подтверждения достижений.

    Используется для хранения информации о различных достижениях студента:
    учебных, культурно-творческих, общественных, спортивных и научно-исследовательских.
    
    Каждый документ привязан к студенту, содержит метаданные (категория, уровень, результат),
    ссылку на файл и проходит процесс модерации (на рассмотрении, подтверждён, отклонён).

    Примечание: использует динамически загружаемые choices через JSON-конфигурацию.
    
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='student_documents')
    
    date_received = models.DateField("Дата получения", default=timezone.now) 
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_documents', verbose_name='Кем проверено')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    category = models.CharField(max_length=50, choices=get_choices_from_config('categories'))
    sub_type = models.CharField("Подтип", max_length=50, choices=get_choices_from_config('sub_types'), default='other')
    level = models.CharField("Уровень", max_length=50, choices=get_choices_from_config('metadata.levels'), default='none')
    result = models.CharField("Результат", max_length=50, choices=get_choices_from_config('metadata.results'), default='other')
    achievement = models.CharField("Название достижения", max_length=255)
    doc_type = models.CharField("Тип документа", max_length=50, choices=get_choices_from_config('metadata.doc_types'), default='other')
    
    original_file_name = models.CharField(max_length=255, default='NO_FILENAME')
    file_url = models.URLField(max_length=500, null=True, blank=True)

    score = models.PositiveIntegerField("Баллы", default=0)
    status = models.CharField(max_length=20, choices=get_choices_from_config('metadata.statuses'), default='pending')
    rejection_reason = models.TextField("Причина отказа", blank=True, null=True)
    
    def __str__(self) -> str:
        """
        Возвращает строковое представление объекта документа.

        Отображает название достижения и текущий статус в читаемом виде.

        Пример: "Победа в олимпиаде (Подтверждено)"

        Возвращает:
            str: Строка с названием достижения и статусом.
        """
        return f"{self.achievement} ({self.get_status_display()})"
    
    def save(self, *args, **kwargs):
        """
        Переопределённый метод сохранения объекта.

        Перед сохранением автоматически пересчитывает количество баллов
        на основе категории, подтипа, уровня и результата с использованием
        внешней функции calculate_achievement_score.

        Параметры:
            *args: Позиционные аргументы, передаваемые в родительский метод.
            **kwargs: Именованные аргументы, передаваемые в родительский метод.
        """
        self.score = calculate_achievement_score(
            self.category, self.sub_type, self.level, self.result
        )
        super().save(*args, **kwargs)

    class Meta:
        """
        Метакласс для настройки поведения модели.

        Задаёт человекочитаемые названия и порядок сортировки записей.
        """
        verbose_name = "Документ"
        verbose_name_plural = "Документы"
        ordering = ['-uploaded_at']
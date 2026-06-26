from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models import F, GeneratedField, IntegerField

from university_structure.models import Group, Faculty, Department
from core.students_manager import StudentQuerySet
import uuid


class Student(models.Model):
    """
    Модель профиля студента.

    Связывает пользователя системы с его академическими и внеучебными данными.
    Хранит информацию о студенте, включая личные данные, учебную группу, кафедру, факультет,
    номер зачётной книжки, контактную информацию и баллы по различным направлениям активности.
    """
    external_id = models.CharField("Код студента", max_length=50, unique=True, help_text="Код студента из БД вуза")
    # external_id = models.CharField("Код студента", max_length=50, unique=True, null=True, blank=True, help_text="Код студента из БД вуза")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='student_profile')
    full_name = models.CharField("ФИО", max_length=255, help_text="Полное ФИО студента")
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='students', null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='students', null=True, blank=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='students', null=True, blank=True)  
    
    record_book = models.CharField("Зачетка", max_length=50, null=True, blank=True)
    email = models.EmailField("Email", blank=True, null=True)
    status = models.CharField("Статус", max_length=5, default=1, help_text="Код статуса")
    status_decoding = models.CharField("Расшифровка Статуса", max_length=255, default=1, help_text="Расшифровка кода статуса")
    admission_year = models.PositiveIntegerField("Год поступления", null=True)
    is_monitor = models.BooleanField("Староста", default=False)
    
    academic_score = models.PositiveIntegerField(default=0)
    research_score = models.PositiveIntegerField(default=0)
    sport_score = models.PositiveIntegerField(default=0)
    social_score = models.PositiveIntegerField(default=0)
    cultural_score = models.PositiveIntegerField(default=0)
    
    total_score = GeneratedField(
        expression=(
            F('academic_score') + 
            F('research_score') + 
            F('sport_score') + 
            F('social_score') + 
            F('cultural_score')
        ),
        output_field=IntegerField(),
        db_persist=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    objects = StudentQuerySet.as_manager()

    class Meta:
        verbose_name = "Профиль студента"
        verbose_name_plural = "Профили студентов"
        indexes = [
            models.Index(fields=['-total_score']),
            models.Index(fields=['group', 'faculty']),
        ]

    def __str__(self):
        group_name = self.group.name if self.group else "Без группы"
        return f"{self.full_name} ({group_name})"

class MetadataBase(models.Model):
    """
    Абстрактная базовая модель для всех справочников (метаданные)
    """
    code = models.CharField("Код", max_length=50, unique=True)
    label = models.CharField("Название", max_length=255)

    class Meta:
        abstract = True
        ordering = ['label']

    def __str__(self):
        return self.label

class Level(MetadataBase):
    class Meta(MetadataBase.Meta):
        verbose_name = "Уровень достижения"
        verbose_name_plural = "Уровни достижений"

class AchievementResult(MetadataBase):
    class Meta(MetadataBase.Meta):
        verbose_name = "Результат достижения"
        verbose_name_plural = "Результаты достижений"

class DocType(MetadataBase):
    class Meta(MetadataBase.Meta):
        verbose_name = "Тип документа"
        verbose_name_plural = "Типы документов"

class DocumentStatus(MetadataBase):
    class Meta(MetadataBase.Meta):
        verbose_name = "Статус документа"
        verbose_name_plural = "Статусы документов"

class Category(models.Model):
    """
    Категория достижения (например: academic, sport, science)
    """
    code = models.CharField(max_length=50, unique=True, verbose_name="Код")
    label = models.CharField(max_length=255, verbose_name="Название")

    class Meta:
        """
        Метакласс для настройки поведения модели.

        Задаёт человекочитаемые названия и порядок сортировки записей.
        """
        verbose_name = "Категория достижения"
        verbose_name_plural = "Категории достижений"

    def __str__(self):
        return self.label

class AchievementType(models.Model):
    """
    Подвид достижения (например: olympiad, conference, publication)
    
    флаги для клиента needs_level и needs_result: нужно ли запрашивать уровень и результат
    """
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='sub_types')
    code = models.CharField(max_length=50, verbose_name="Код")
    label = models.CharField(max_length=100, verbose_name="Название")
    

    needs_level = models.BooleanField(default=False, verbose_name="Требует указания уровня")
    needs_result = models.BooleanField(default=False, verbose_name="Требует указания результата")

    class Meta:
        unique_together = ('category', 'code')
        verbose_name = "Тип достижения"
        verbose_name_plural = "Типы достижений"

    def __str__(self):
        return f"{self.category.label} - {self.label}"

class ScoringRule(models.Model):
    """
    Правила начисления баллов
    Пока добавить нечего
    """
    
    achievement_type = models.ForeignKey(AchievementType, on_delete=models.CASCADE, related_name='rules')
    
    level = models.ForeignKey(Level, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Уровень") 
    result = models.ForeignKey(AchievementResult, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Результат")
    
    score = models.IntegerField(verbose_name="Количество баллов")

    def __str__(self):
        return f"{self.achievement_type} | Уровень: {self.level or 'Любой'} | Результат: {self.result or 'Любой'} -> {self.score}"

    class Meta:
        """
        Метакласс для настройки поведения модели.

        Задаёт человекочитаемые названия и порядок сортировки записей.
        """
        verbose_name = "Правило счёта"
        verbose_name_plural = "Правила счёта"
        indexes = [
            models.Index(fields=['achievement_type', 'level', 'result']),
        ]

class Document(models.Model):
    """
    Модель документа студента для подтверждения достижений.

    Используется для хранения информации о различных достижениях студента:
    учебных, культурно-творческих, общественных, спортивных и научно-исследовательских.
    
    Каждый документ привязан к студенту, содержит метаданные (категория, уровень, результат),
    ссылку на файл и проходит процесс модерации (на рассмотрении, подтверждён, отклонён).   
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='documents', verbose_name="Пользователь")
    date_received = models.DateField("Дата получения", default=timezone.now)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_documents', verbose_name='Кем проверено')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    category = models.ForeignKey(Category, on_delete=models.PROTECT, verbose_name="Категория")
    sub_type = models.ForeignKey(AchievementType, on_delete=models.PROTECT, verbose_name="Подтип")
    level = models.ForeignKey(Level, on_delete=models.PROTECT, null=True, blank=True, verbose_name="Уровень")
    result = models.ForeignKey(AchievementResult, on_delete=models.PROTECT, null=True, blank=True, verbose_name="Результат")
    achievement = models.CharField("Название достижения", max_length=1000)
    doc_type = models.ForeignKey(DocType, on_delete=models.PROTECT, verbose_name="Тип документа")
    
    score = models.PositiveIntegerField("Баллы", default=0)
    status = models.ForeignKey(DocumentStatus, on_delete=models.PROTECT, verbose_name="Статус")
    rejection_reason = models.CharField("Причина отказа", blank=True, null=True, max_length=500)
    
    def __str__(self) -> str:
        """
        Возвращает строковое представление объекта документа.

        Отображает название достижения и текущий статус в читаемом виде.

        Пример: "Победа в олимпиаде (Подтверждено)"

        Возвращает:
            str: Строка с названием достижения и статусом.
        """
        return f"{self.achievement} ({self.status})"
    
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
        from .scoring import calculate_achievement_score
        self.score = calculate_achievement_score(
            self.category.code, 
            self.sub_type.code, 
            self.level.code if self.level else None, 
            self.result.code if self.result else None
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
        indexes = [
            models.Index(fields=['status', 'user']),
            models.Index(fields=['-uploaded_at']),
            models.Index(fields=['date_received', 'status']),
        ]

def achievement_directory_path(instance, filename):
    """
    Генерирует путь для сохранения файла в SeaweedFS.
    Формат: <зачетка_студента>/<uuid>.<расширение>
    """
    ext = filename.split('.')[-1]
    unique_name = f"{uuid.uuid4()}.{ext}"
    
    try:
        record_book = instance.document.user.student_profile.record_book
    except AttributeError:
        record_book = 'unknown_student'
        
    return f"{record_book}/{unique_name}"

class DocumentFile(models.Model):
    """
    Модель для хранения файлов, прикреплённых к документу достижения.
    Один документ может иметь несколько файлов.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='files', verbose_name="Документ")
    original_file_name = models.CharField("Оригинальное имя файла", max_length=255, default='NO_FILENAME')
    file = models.FileField("Файл", upload_to=achievement_directory_path)
    uploaded_at = models.DateTimeField("Дата загрузки", auto_now_add=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0, help_text="Для сортировки файлов")


    class Meta:
        verbose_name = "Файл документа"
        verbose_name_plural = "Файлы документов"
        ordering = ['order', 'uploaded_at']

    def __str__(self):
        return self.original_file_name
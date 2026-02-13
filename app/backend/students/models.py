from django.db import models
from django.conf import settings

from university_structure.models import Group, Faculty

class Student(models.Model):
    """
    Модель профиля студента.

    Связывает пользователя системы с его академическими и внеучебными данными.
    Хранит информацию о студенте, включая личные данные, учебную группу, факультет,
    номер зачётной книжки, контактную информацию и баллы по различным направлениям активности.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='student_profile')
    full_name = models.CharField(max_length=150)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='students', null=True, blank=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='students', null=True, blank=True)
    record_book = models.CharField(max_length=30, null=True, blank=True)
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
        """
        Метакласс для настройки отображения модели в административной панели Django.

        Атрибуты:
            verbose_name: str: Человекочитаемое имя модели в единственном числе.
            verbose_name_plural: str: Человекочитаемое имя модели во множественном числе.
        """
        verbose_name: str = "Профиль студента"
        verbose_name_plural: str = "Профили студентов"

    def __str__(self):
        """
        Возвращает строковое представление объекта студента.

        Отображает полное имя студента и название группы, если группа назначена.
        Если студент не состоит в группе, подставляется «Без группы».

        Возвращает cтроку в формате "ФИО (Группа)" или "ФИО (Без группы)".
        """
        group_name: str = self.group.name if self.group else "Без группы"
        return f"{self.full_name} ({group_name})"


class Document(models.Model):
    """
    Модель документа студента для подтверждения достижений.

    Используется для хранения информации о различных достижениях студента разных категорий: учебная, культурно-творческая, общественная, спортивная и научно-исследовательская.
    Пока всё это добро хардкодим, позже сделаем нормально
    
    Каждый документ связан со студентом и проходит модерацию (на рассмотрении, подтверждён, отклонён).
    """

    CATEGORY_CHOICES: list[tuple[str, str]] = [
        ('academic', 'Учебная'),
        ('cultural', 'Культурно-творческая'),
        ('social', 'Общественная'),
        ('sport', 'Спортивная'),
        ('research', 'Научно-исследовательская'),
    ]
    """
    Категории достижений - основное направление активности студента.
    Определяет, к какой области относится достижение.
    """

    LEVEL_CHOICES: list[tuple[str, str]] = [
        ('world', 'Международный (Мир)'),
        ('international', 'Международный'),
        ('russian', 'Всероссийский / РФ'),
        ('cfo', 'Окружной (ЦФО)'),
        ('regional', 'Областной / Региональный'),
        ('university', 'Вузовский'),
        ('none', 'Не применимо'),
    ]
    """
    Уровни достижений - масштаб мероприятия или результата.
    Используется для начисления баллов в зависимости от престижа события.
    """

    RESULT_CHOICES: list[tuple[str, str]] = [
        ('1', '1 место / Победитель'),
        ('2', '2 место / Призер'),
        ('3', '3 место / Призер'),
        ('excellent', 'Только "отлично"'),
        ('good_excellent', '«Хорошо» и «отлично»'),
        ('vak_rinc', 'ВАК / РИНЦ'),
        ('other', 'Прочие'),
        ('none', 'Не применимо'),
    ]
    """
    Результат участия — конкретный итог, достигнутый студентом.
    Может быть местом в конкурсе, уровнем успеваемости или типом публикации.
    """

    SUB_TYPE_CHOICES: list[tuple[str, str]] = [
        ('grades', 'Успеваемость'),
        ('olympiad', 'Олимпиада / Конкурс'),
        ('education', 'Доп. обр. программа'),
        
        ('contest', 'Научный конкурс'), 
        ('publication', 'Публикация'),
        ('conference', 'Доклад на конференции'),
    
        ('msmk', 'Мастер спорта межд. класса'),
        ('team_russia', 'Член сборной России'),
        ('competition', 'Спортивное соревнование'),
        ('promotion', 'Популяризация спорта'),
        
        ('elder', 'Староста'),
        ('union', 'Профсоюз / Студсовет'),
        ('volunteer', 'Волонтерская деятельность'),
        ('career', 'Профориентация / Лагеря'),
    ]
    """
    Подтипы документов - детализация типа достижения внутри категории.
    Позволяет точнее классифицировать активность и применять правила начисления баллов.
    """

    DOC_TYPE_CHOICES: list[tuple[str, str]] = [
        ('diploma', 'Диплом'),
        ('certificate', 'Сертификат'),
        ('certificate_of_participation', 'Свидетельство об участии'),
        ('letter_of_thanks', 'Благодарственное письмо'),
        ('other', 'Другое'),
    ]
    """
    Тип документа - вид подтверждающего файла.
    Определяет форму подтверждения достижения (например, диплом, сертификат и т.д.).
    """

    STATUS_CHOICES: list[tuple[str, str]] = [
        ('pending', 'На рассмотрении'),
        ('approved', 'Подтверждено'),
        ('rejected', 'Отклонено'),
    ]
    """
    Статус документа - текущее состояние модерации.
    Отражает, был ли документ проверен и принят системой.
    """

    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE,
        related_name='student_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    category = models.CharField(max_length=255, choices=CATEGORY_CHOICES)
    sub_type = models.CharField("Подтип", max_length=255, choices=SUB_TYPE_CHOICES, default='other')
    level = models.CharField("Уровень", max_length=255, choices=LEVEL_CHOICES, default='none')
    result = models.CharField("Результат", max_length=255, choices=RESULT_CHOICES, default='other')
    achievement = models.CharField("Название достижения", max_length=255)
    score = models.PositiveIntegerField("Баллы", default=0)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField("Причина отказа", blank=True, null=True)
    doc_type = models.CharField(
        max_length=255, 
        choices=DOC_TYPE_CHOICES, 
        default='other'
    )
    original_file_name = models.CharField(max_length=255, default='NO_FILENAME')
    file_url = models.URLField(
        max_length=500,
        null=True,
        blank=True
    )

    def __str__(self) -> str:
        """
        Возвращает строковое представление объекта документа.

        Отображает название достижения и текущий статус в читаемом виде.
        Пока нигде не используется.

        Пример: "Победа в олимпиаде - Подтверждено"
        """
        return f"{self.achievement} - {self.get_status_display()}"
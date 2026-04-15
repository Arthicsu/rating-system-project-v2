from django.conf import settings
import json
from django.core.cache import cache
from students.models import Category, Level, AchievementResult, DocType, ScoringRule

def get_cached_metadata(model_class, cache_key: str) -> list[dict]:
    """
    Универсальная функция для получения справочников с кэшированием.
    Возвращает список словарей [{"value": "code", "label": "Название"}, ...]
    """
    data = cache.get(cache_key)
    
    if data is None:
        qs = model_class.objects.values_list('code', 'label')
        data = [{"value": code, "label": label} for code, label in qs]
        
        cache.set(cache_key, data, timeout=43200)
        
    return data
    
def calculate_achievement_score(category_code, sub_type_code, level_code=None, result_code=None):
    """
    Вычисляет балл за достижение на основе заданных категории, подтипа, уровня и результата.

    Функция использует правила счёта из бд,
    чтобы определить количество баллов в зависимости от параметоров достижения (категория, подтип, уровень, результат) студента.
    Поиск подходящего значения происходит по заранее определённому приоритету:

    1. Полное совпадение: категория → подтип → уровень → результат. (category -> sub_type -> level -> result)
    2. Для случаев без уровня, например, публикации: категория → подтип → результат (category -> sub_type -> result).
    3. Упрощённое начисление, например, волонтерство: категория → подтип → 'default' (category -> sub_type -> 'default').
    
    Параметры:
        category (str): Категория достижения (например, 'academic', 'research').
        sub_type (str): Подтип достижения (например, 'olympiad', 'publication').
        level (str, optional): Уровень мероприятия. По умолчанию None.
        result (str, optional): Результат участия (место, тип успеваемости и т.д.). По умолчанию None.
    """


    # Фильтруем через __code для связанных полей Level и AchievementResult
    query_params = {
        'achievement_type__category__code': category_code,
        'achievement_type__code': sub_type_code,
    }
    
    # Фильтр по коду уровня, если он передан, иначе ищем NULL
    if level_code:
        query_params['level__code'] = level_code
    else:
        query_params['level__isnull'] = True

    # Фильтр по коду результата
    if result_code:
        query_params['result__code'] = result_code
    else:
        query_params['result__isnull'] = True

    rule = ScoringRule.objects.filter(**query_params).first()

    if rule:
        return rule.score

    # Если точного совпадения нет, ищем дефолтное правило
    default_rule = ScoringRule.objects.filter(
        achievement_type__category__code=category_code,
        achievement_type__code=sub_type_code,
        level__isnull=True,
        result__isnull=True
    ).first()

    return default_rule.score if default_rule else 0

def get_scoring_structure() -> dict:
    """
    Формирует структуру правил начисления баллов для клиентской части приложения.

    Функция загружает правила из JSON-конфигурации (через structure) и преобразует их
    в удобный для фронтенда формат, описывающий категории и подтипы достижений,
    а также указывающий, требуют ли они выбора уровня и результата.

    Используется, например, для динамической генерации форм ввода достижений.

    Возвращает:
        dict: Словарь, где ключи - внутренние коды категорий (например, 'academic'),
              а значения содержат:
                - label (str): Человекочитаемое название категории.
                - sub_types (list): Список подтипов с полями:
                    - value (str): Код подтипа.
                    - label (str): Отображаемое название подтипа.
                    - needsLevel (bool): Требуется ли выбор уровня (например, всероссийский, вузовский).
                    - needsResult (bool): Требуется ли указание результата (место, тип успеваемости и т.д.).

    Пример возвращаемого значения:
        {
            "academic": {
                "label": "Учебная",
                "sub_types": [
                    {
                        "value": "grades",
                        "label": "Успеваемость",
                        "needsLevel": False,
                        "needsResult": True
                    }
                ]
            }
        }

    Замечания:
        - Для определения наличия уровней проверяется, содержит ли хотя бы одно значение словаря подтипа вложенный словарь.
        - Если у подтипа есть ключ 'default', считается, что результат не требуется (т.е фиксированный балл).
    """
    
    structure = cache.get('scoring_structure')
    if structure:
        return structure

    structure = {}
    
    categories = Category.objects.prefetch_related('sub_types', 'sub_types__rules', 'sub_types__rules__result').all()

    for category in categories:
        sub_types_list = []
        for sub_type in category.sub_types.all():
            allowed_results = [
                rule.result.code 
                for rule in sub_type.rules.all() 
                if rule.result and rule.result.code != 'none'
            ]
            sub_types_list.append({
                "value": sub_type.code,
                "label": sub_type.label,
                "needsLevel": sub_type.needs_level,
                "needsResult": sub_type.needs_result,
                "allowedResults": list(set(allowed_results))
            })

        structure[category.code] = {
            "label": category.label,
            "sub_types": sub_types_list
        }
        
    cache.set('scoring_structure', structure, timeout=43200) 
    return structure
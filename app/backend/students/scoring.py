from django.conf import settings
import json
from students.models import Document

config_path = settings.SCORING_CONFIG_PATH

def load_rules() -> dict:
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Scoring config not found at {config_path}")
        return {}
    except json.JSONDecodeError:
        print("Error: Invalid JSON in scoring config")
        return {}

def calculate_achievement_score(category, sub_type, level='none', result='none'):
    """
    Вычисляет балл за достижение на основе заданных категории, подтипа, уровня и результата.

    Функция использует внешние правила из JSON-конфигурации (загружается через load_rules),
    чтобы определить количество баллов в зависимости от типа активности студента.
    Поиск подходящего значения происходит по заранее определённому приоритету:

    1. Полное совпадение: категория → подтип → уровень → результат. (category -> sub_type -> level -> result)
    2. Для случаев без уровня, например, публикации: категория → подтип → результат (category -> sub_type -> result).
    3. Упрощённое начисление, например, волонтерство: категория → подтип → 'default' (category -> sub_type -> 'default').
    
    Параметры:
        category (str): Категория достижения (например, 'academic', 'research').
        sub_type (str): Подтип достижения (например, 'olympiad', 'publication').
        level (str, optional): Уровень мероприятия. По умолчанию 'none'.
        result (str, optional): Результат участия (место, тип успеваемости и т.д.). По умолчанию 'none'.

    Возвращает:
        int: Количество начисляемых баллов. Если правило не найдено — возвращает 0.

    Примеры использования:
        calculate_achievement_score('academic', 'grades', result='excellent')  # Успеваемость: "отлично"
        calculate_achievement_score('sport', 'competition', level='university', result='1')  # Спорт, 1 место, вузовский уровень
    """
    rules: dict = load_rules()
    
    cat_rules = rules.get(category)
    if not cat_rules:
        return 0
    
    sub_rules = cat_rules.get(sub_type)
    if not sub_rules:
        return 0
    
    if level in sub_rules and isinstance(sub_rules[level], dict):
        return sub_rules[level].get(result, 0)
    
    if result in sub_rules and isinstance(sub_rules[result], int):
        return sub_rules[result]
    
    if 'default' in sub_rules:
        return sub_rules['default']

    return 0

def get_scoring_structure() -> dict:
    """
    Формирует структуру правил начисления баллов для клиентской части приложения.

    Функция загружает правила из JSON-конфигурации (через load_rules) и преобразует их
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
    
    rules: dict = load_rules()
    
    cat_map: dict[str, str] = dict(Document.CATEGORY_CHOICES)
    sub_map: dict[str, str] = dict(Document.SUB_TYPE_CHOICES)

    structure: dict = {}

    for cat_key, sub_types in rules.items():
        sub_types_list: list = []
        for sub_key, sub_content in sub_types.items():
            has_levels: bool = isinstance(sub_content, dict) and any(
                isinstance(v, dict) for v in sub_content.values()
            )
            
            has_results: bool = isinstance(sub_content, dict) and 'default' not in sub_content

            sub_types_list.append({
                "value": sub_key,
                "label": sub_map.get(sub_key, sub_key),
                "needsLevel": has_levels,
                "needsResult": has_results
            })

        structure[cat_key] = {
            "label": cat_map.get(cat_key, cat_key),
            "sub_types": sub_types_list
        }
    
    return structure
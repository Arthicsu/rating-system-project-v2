from django.conf import settings
import json

config_path = settings.SCORING_CONFIG_PATH

def load_rules() -> dict:
    """
    Загружает и возвращает конфигурацию правил начисления баллов из JSON-файла.

    Функция читает файл, путь к которому определён в переменной `config_path`,
    и преобразует его содержимое в словарь. 
    
    Конфигурация используется для определения баллов за достижения в зависимости от категории, подтипа, уровня и результата.

    Возвращает:
        dict: Словарь с правилами начисления баллов из конфига. 
        При ошибках возвращается пустой словарь.

    Обрабатываемые ошибки:
        FileNotFoundError: Если файл по указанному пути не найден.
                           Выводится сообщение об ошибке, возвращается {}.
        json.JSONDecodeError: Если содержимое файла некорректно (не валидный JSON).
                            Выводится сообщение об ошибке, возвращается {}.
    """
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

def get_choices_from_config(key_path) -> list[tuple] | list:
    """
    Возвращает список значений для использования в полях модели Django с параметром choices.

    Функция извлекает данные из scoring_config.json (загружается через load_rules) и форматирует их в виде списка кортежей.

    Параметры:
        key_path (str): Путь к данным в конфигурации. Поддерживаемые значения:
            - 'metadata.levels' — уровни достижений (например, Международный (Мир), Всероссийский / РФ).
            - 'metadata.results' — возможные результаты (1 место / Победитель, «Хорошо» и «отлично» и т.п.).
            - 'categories' — категории достижений (Учебная, Научно-исследовательская и т.д.).
            - 'sub_types' — все подтипы достижений по всем категориям (без дубликатов).

    Возвращает:
        list[tuple]: Список кортежей (ключ, метка) для использования в choices.
                     Возвращает пустой список, если секция не найдена или путь неверен.

    Примеры:
        get_choices_from_config('metadata.levels')  # → [('international', 'Международный'), ...]
        get_choices_from_config('categories')       # → [('academic', 'Учебная'), ...]
        get_choices_from_config('sub_types')        # → [('olympiad', 'Олимпиада / Конкурс'), ('grades', 'Успеваемость'), ...]

    Особенности:
        - Для 'metadata.*' извлекаются плоские словари из раздела metadata конфигурации.
        - Для 'categories' берётся основной уровень конфигурации (кроме 'metadata').
        - Для 'sub_types' проходится вся структура, извлекаются все подтипы, удаляются дубликаты.
        - Если метка отсутствует в данных, используется ключ как значение по умолчанию.

    Используется для динамического формирования выпадающих списков в формах и моделях из scoring_config.json.
    """
    rules = load_rules()
    
    if key_path.startswith('metadata.'):
        section = key_path.split('.')[1]
        data = rules.get('metadata', {}).get(section, {})
        return [(k, v) for k, v in data.items()]

    if key_path == 'categories':
        return [(k, v['label']) for k, v in rules.items() if k != 'metadata']

    if key_path == 'sub_types':
        sub_types = []
        for cat_key, cat_data in rules.items():
            if cat_key == 'metadata': continue
            for sub_key, sub_data in cat_data.items():
                if sub_key == 'label': continue
                sub_types.append((sub_key, sub_data.get('label', sub_key)))
        return list(set(sub_types))

    return []

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
    structure: dict = {}

    for cat_key, cat_content in rules.items():
        if cat_key == 'metadata':
            continue

        sub_types_list = []
        for sub_key, sub_content in cat_content.items():
            if sub_key == 'label':
                continue

            logic_data = {k: v for k, v in sub_content.items() if k != 'label'}
            
            has_levels = any(isinstance(v, dict) for v in logic_data.values())
            
            has_results = 'default' not in logic_data

            sub_types_list.append({
                "value": sub_key,
                "label": sub_content.get('label', sub_key),
                "needsLevel": has_levels,
                "needsResult": has_results
            })

        structure[cat_key] = {
            "label": cat_content.get('label', cat_key),
            "sub_types": sub_types_list
        }
    
    return structure
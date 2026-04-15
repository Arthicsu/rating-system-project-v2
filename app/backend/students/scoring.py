from students.models import ScoringRule


def calculate_achievement_score(category_code, sub_type_code, level_code=None, result_code=None):
    """
    Вычисляет балл за достижение на основе заданных категории, подтипа, уровня и результата.

    Функция использует правила счёта из бд,
    чтобы определить количество баллов в зависимости от параметоров достижения (категория, подтип, уровень, результат) студента.
    Поиск подходящего значения происходит по заранее определённому приоритету:

    1. Полное совпадение: категория → подтип → уровень → результат.
    2. Для случаев без уровня: категория → подтип → результат.
    3. Упрощённое начисление: категория → подтип → 'default'.
    
    Параметры:
        category_code (str): Категория достижения (например, 'academic', 'research').
        sub_type_code (str): Подтип достижения (например, 'olympiad', 'publication').
        level_code (str, optional): Уровень мероприятия. По умолчанию None.
        result_code (str, optional): Результат участия. По умолчанию None.
    """
    query_params = {
        'achievement_type__category__code': category_code,
        'achievement_type__code': sub_type_code,
    }
    
    if level_code:
        query_params['level__code'] = level_code
    else:
        query_params['level__isnull'] = True

    if result_code:
        query_params['result__code'] = result_code
    else:
        query_params['result__isnull'] = True

    rule = ScoringRule.objects.filter(**query_params).first()

    if rule:
        return rule.score

    default_rule = ScoringRule.objects.filter(
        achievement_type__category__code=category_code,
        achievement_type__code=sub_type_code,
        level__isnull=True,
        result__isnull=True
    ).first()

    return default_rule.score if default_rule else 0

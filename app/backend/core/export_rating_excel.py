import io

import xlsxwriter

# Поля queryset и их заголовки в файле, в порядке колонок.
COLUMNS = [
    ('full_name', 'ФИО'),
    ('group__course', 'Курс'),
    ('faculty__short_name', 'Факультет'),
    ('group__name', 'Группа'),
    ('group__academic_year', 'Год'),
    ('academic_score', 'Учебная'),
    ('research_score', 'Научно-исследовательская'),
    ('sport_score', 'Спортивная'),
    ('social_score', 'Общественная'),
    ('cultural_score', 'Культурно-творческая'),
    ('total_score', 'Всего'),
]


def generate_rating_excel(queryset) -> bytes:
    fields = [field for field, _ in COLUMNS]
    headers = [title for _, title in COLUMNS]
    rows = list(queryset.values(*fields))

    output = io.BytesIO()
    # strings_to_formulas/urls=False: значения из БД (в т.ч. ФИО, которое студент
    # задаёт сам при регистрации) всегда пишутся как текст, иначе строка вида
    # "=..." сохранилась бы исполняемой формулой Excel (formula injection).
    workbook = xlsxwriter.Workbook(output, {
        'in_memory': True,
        'strings_to_formulas': False,
        'strings_to_urls': False,
    })
    worksheet = workbook.add_worksheet('Рейтинг')

    worksheet.write_row(0, 0, headers)

    # Ширина колонки по самому длинному значению против заголовка, потолок 50.
    widths = [len(h) for h in headers]
    for row_idx, row in enumerate(rows, start=1):
        for col_idx, field in enumerate(fields):
            value = row[field]
            if value is None:
                value = 0
            worksheet.write(row_idx, col_idx, value)
            widths[col_idx] = max(widths[col_idx], len(str(value)))

    for col_idx, width in enumerate(widths):
        worksheet.set_column(col_idx, col_idx, min(width + 2, 50))

    workbook.close()
    return output.getvalue()

"""
Очистка строк CSV студентов перед импортом.

Встроенная версия скрипта RemoveDublicateFromStudentCSV, которым ОИ чистил выгрузку
вручную. Правило то же: среди активных строк с одной почтой остаётся последняя.
Отличия от скрипта (иначе ломается архивация или теряются студенты):
- строки отчисленных/выпускников (Student.TERMINAL_STATUSES) не вырезаются: по ним
  импорт переводит студентов в архив, в поиске дублей они не участвуют;
- пустая почта дублем не считается (скрипт оставлял из всех таких строк одну);
- почта сравнивается без учёта регистра и пробелов: почтовые сервисы регистр не
  различают, а в выгрузке встречаются Ivanov@ и ivanov@ одного человека.
"""
import csv
import io
from typing import NamedTuple

from .models import Student

# Причины, по которым строка выгрузки не попала в БД (общий отчёт импорта).
REASON_LABELS = {
    'duplicate': 'Повтор того же студента (тот же Код) - оставлена последняя строка',
    'email_conflict': 'Разные студенты с одной почтой - оставлена последняя строка',
    'email_taken': 'Почта уже занята другим аккаунтом в БД - студент не создан, проверьте вручную',
    'no_group': 'Группа не найдена в БД - сначала синхронизируйте структуру и повторите импорт',
    'unknown_status': 'Неизвестный код статуса - строка пропущена',
}


class CleanResult(NamedTuple):
    rows: list
    removed: list  # [(строка, 'duplicate' | 'email_conflict')]


def normalize_email(raw) -> str:
    value = str(raw or '').strip().lower()
    return '' if value == 'null' else value


def _dedupe_key(row) -> str:
    """Нормализованная почта активной строки; '' - строка в поиске дублей не участвует."""
    if str(row.get('Статус', '')).strip() in Student.TERMINAL_STATUSES:
        return ''
    return normalize_email(row.get('E_Mail'))


def clean_student_rows(rows) -> CleanResult:
    """Один проход O(n): для каждой почты запоминаем последнюю строку, остальные - в отчёт."""
    keys = [_dedupe_key(row) for row in rows]
    last_index = {key: i for i, key in enumerate(keys) if key}

    kept, removed = [], []
    for i, (row, key) in enumerate(zip(rows, keys)):
        if key and last_index[key] != i:
            same_code = str(rows[last_index[key]].get('Код', '')).strip() == str(row.get('Код', '')).strip()
            removed.append((row, 'duplicate' if same_code else 'email_conflict'))
        else:
            kept.append(row)
    return CleanResult(kept, removed)


def build_import_report_csv(removed) -> str:
    """CSV удалённых строк (колонки исходного файла + «Причина»); BOM - чтобы Excel понял кириллицу."""
    if not removed:
        return ''
    fieldnames = list(removed[0][0].keys())
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=';')
    writer.writerow([*fieldnames, 'Причина'])
    for row, reason in removed:
        writer.writerow([*(row.get(name, '') for name in fieldnames), REASON_LABELS[reason]])
    return '﻿' + buffer.getvalue()

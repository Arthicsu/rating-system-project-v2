from django.conf import settings

from datetime import datetime
import os, csv


def log_generated_passwords(credentials_list, prefix="students"):
    """
    Записывает сгенерированные пароли и данные для поиска студента в CSV-файл
    в общий каталог settings.IMPORT_PASSWORDS_DIR (расшаривается с ПК работника ОИ),
    чтобы потом выдать студентам новые пароли «на листочке».
    """
    if not credentials_list:
        return None

    folder_path = settings.IMPORT_PASSWORDS_DIR
    if not os.path.exists(folder_path):
        os.makedirs(folder_path, exist_ok=True)

    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    filename = f"{prefix}_creds_{timestamp}.csv"
    file_path = os.path.join(folder_path, filename)

    with open(file_path, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow([
            'Факультет', 'Кафедра', 'Курс', 'Группа', 'ФИО', 'Зачётка',
            'Логин', 'Пароль', 'Год_поступления', 'Email',
        ])
        for item in credentials_list:
            writer.writerow([
                item.get('faculty', '-'),
                item.get('department', '-'),
                item.get('course', '-'),
                item.get('group', '-'),
                item.get('full_name', '-'),
                item.get('record_book', '-'),
                item.get('login', '-'),
                item.get('password', '-'),
                item.get('admission_year', '-'),
                item.get('email', '-'),
            ])

    return filename, file_path
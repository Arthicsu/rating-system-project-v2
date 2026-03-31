from django.conf import settings

from datetime import datetime
import os, csv


def log_generated_passwords(credentials_list, prefix="students"):
    """
    Записывает сгенерированные пароли в CSV файл в папку media/import_passwords/.
    credentials_list: список словарей [{'fio': '...', 'login': '...', 'password': '...'}]
    """
    if not credentials_list:
        return None

    folder_path = os.path.join(settings.MEDIA_ROOT, 'import_passwords')
    if not os.path.exists(folder_path):
        os.makedirs(folder_path, exist_ok=True)

    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    filename = f"{prefix}_creds_{timestamp}.csv"
    file_path = os.path.join(folder_path, filename)

    with open(file_path, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['Код_группы', 'Группа', 'Год_поступления', 'ФИО', 'Логин', 'Пароль'])
        for item in credentials_list:
            writer.writerow([
                item.get('group_code', '-'),
                item.get('group', '-'),
                item.get('admission_year', '-'),
                item.get('full_name', '-'),
                item.get('login', '-'),
                item.get('password', '-')
            ])

    return filename, file_path
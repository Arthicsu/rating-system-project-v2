"""
Импорт файлов (CSV/JSON) в ModelAdmin.

Общая механика одна: форма загрузки -> парсинг файла -> process_import ->
сообщения -> redirect к списку. Формат задаёт только parse_import_file
в наследнике (CsvImport / JsonImport).
"""
from django import forms
from django.contrib import messages
from django.shortcuts import render, redirect
from django.urls import path
import csv
import json


class ImportForm(forms.Form):
    file = forms.FileField(label="Выберите файл")


class BaseImport:
    """
    Универсальный миксин импорта для ModelAdmin.

    Наследник задаёт parse_import_file (формат файла) и process_import
    (запись данных в БД; возврат int — число импортированных строк).
    """
    import_form_class = ImportForm
    import_template = "admin/import_form.html"
    # Подпись формата в заголовке формы импорта.
    import_format = ""

    def get_import_urls(self):
        """
        Возвращает URL для импорта.
        """
        model_name = self.model._meta.model_name
        return [
            path(
                f'import-{model_name}/',
                self.admin_site.admin_view(self.import_view),
                name=f'import-{model_name}',
            ),
        ]

    def import_view(self, request):
        if request.method == "POST":
            form = self.import_form_class(request.POST, request.FILES)
            if form.is_valid():
                try:
                    data = self.parse_import_file(request.FILES['file'])
                    count = self.process_import(request, data)
                    imported = count if isinstance(count, int) else len(data)
                    self.message_user(request, f"Импортировано {imported} из {len(data)} строк.", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка при импорте: {e}", messages.ERROR)
                return redirect("..")

        context = {
            **self.admin_site.each_context(request),
            'form': self.import_form_class(),
            'title': f"Импорт {self.model._meta.verbose_name_plural} из {self.import_format}"
        }
        return render(request, self.import_template, context)

    def parse_import_file(self, uploaded_file):
        raise NotImplementedError("Нужно реализовать этот метод")

    def process_import(self, request, data):
        raise NotImplementedError("Нужно реализовать этот метод")


class CsvImport(BaseImport):
    import_format = "CSV"

    def parse_import_file(self, uploaded_file):
        csv_lines = uploaded_file.read().decode('utf-8-sig').splitlines()
        delimiter = ';' if ';' in csv_lines[0] else ','
        return list(csv.DictReader(csv_lines, delimiter=delimiter))


class JsonImport(BaseImport):
    import_format = "JSON"

    def parse_import_file(self, uploaded_file):
        return json.load(uploaded_file)

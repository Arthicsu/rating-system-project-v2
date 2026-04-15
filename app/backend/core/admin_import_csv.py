from django import forms
from django.contrib import messages
from django.shortcuts import render, redirect
from django.urls import path
import csv


class CsvImportForm(forms.Form):
    csv_file = forms.FileField(label="Выберите CSV файл")

class CsvImport:
    """
    Универсальный класс для импорта CSV в ModelAdmin
    """
    csv_import_form_class = CsvImportForm
    import_template = "admin/import_form.html"
    change_list_template = "admin/csv_import.html"

    def get_import_urls(self):
        """
        Возвращает URL для импорта.
        """        
        model_name = self.model._meta.model_name
        return [
            path(
                f'import-{model_name}/', 
                self.admin_site.admin_view(self.import_csv), 
                name=f'import-{model_name}-csv'
            ),
        ]

    def import_csv(self, request):
        if request.method == "POST":
            form = self.csv_import_form_class(request.POST, request.FILES)
            if form.is_valid():
                raw_file = request.FILES['csv_file'].read().decode('utf-8-sig')
                csv_lines = raw_file.splitlines()
                try:
                    delimiter = ';' if ';' in csv_lines[0] else ','
                    data = list(csv.DictReader(csv_lines, delimiter=delimiter))
                    
                    self.process_import_csv(request, data)
                    self.message_user(request, f"Успешно обработано {len(data)} строк.", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка при импорте: {e}", messages.ERROR)
                return redirect("..")
        
        context = {
            **self.admin_site.each_context(request),
            'form': self.csv_import_form_class(),
            'title': f"Импорт {self.model._meta.verbose_name_plural} из CSV"
        }
        return render(request, self.import_template, context)

    def process_import_csv(self, request, data):
        raise NotImplementedError("Нужно реализовать этот метод")
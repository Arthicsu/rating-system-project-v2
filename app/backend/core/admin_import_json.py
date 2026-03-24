from django import forms
from django.contrib import messages
from django.shortcuts import render, redirect
from django.urls import path
import json


class JsonImportForm(forms.Form):
    json_file = forms.FileField(label="Выберите JSON файл")


class JsonImport:
    """
    Универсальный класс для импорта JSON в ModelAdmin
    """
    json_import_form_class = JsonImportForm
    import_template = "admin/import_form.html"

    def get_import_urls(self):
        """
        Возвращает URL для импорта.
        """        
        model_name = self.model._meta.model_name
        return [
            path(
                f'import-{model_name}/', 
                self.admin_site.admin_view(self.import_json), 
                name=f'import-{model_name}-json'
            ),
        ]
        
    def import_json(self, request):
        if request.method == "POST":
            form = self.json_import_form_class(request.POST, request.FILES)
            if form.is_valid():
                json_file = request.FILES['json_file']
                try:
                    data = json.load(json_file)
                    self.process_import_json(data)
                    self.message_user(request, f"Успешно обработано {len(data)} строк.", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка при импорте: {e}", messages.ERROR)
                return redirect("..")
            
        context = {
            **self.admin_site.each_context(request),
            'form': self.json_import_form_class(),
            'title': f"Импорт {self.model._meta.verbose_name_plural} из JSON"
        }
        return render(request, self.import_template, context)

    def process_import_json(self, data):
        raise NotImplementedError("Нужно реализовать этот метод")
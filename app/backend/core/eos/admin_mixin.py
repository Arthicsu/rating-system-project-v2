from django.contrib import messages
from django.shortcuts import redirect
from django.urls import path

from . import syncers


class EosSyncActionsMixin:
    """
    Кнопки-«object-tools» в правом верхнем углу списка (рядом с «Импорт из CSV»),
    оформленные тем же стилем addlink (см. admin/import_actions.html):
        - «Обновить из ЭОС» — синхронизация текущей таблицы (self.eos_syncer_class);
        - «Обновить ВСЁ из ЭОС» — синхронизация всей структуры
          (faculties → departments → groups), показывается только при eos_sync_all = True.

    Раньше это были пункты выпадающего списка «Действие» и отличались по стилю от
    кнопки импорта — теперь это обычные ссылки-кнопки (GET → выполнить → вернуться к списку).
    Шаблон читает флаги напрямую из ModelAdmin (`cl.model_admin.eos_syncer_class` и т.п.).
    """
    eos_syncer_class = None
    # Подпись кнопки синхронизации текущей таблицы (можно переопределить в ModelAdmin).
    eos_sync_label = "Обновить из ЭОС"
    # Показывать ли кнопку «Обновить ВСЁ из ЭОС (структура)».
    eos_sync_all = False

    def get_eos_urls(self):
        """URL-ы кнопок синхронизации (по образцу CsvImport.get_import_urls)."""
        model_name = self.model._meta.model_name
        urls = []
        if self.eos_syncer_class:
            urls.append(path(
                f'sync-eos-{model_name}/',
                self.admin_site.admin_view(self.sync_eos_view),
                name=f'sync-eos-{model_name}',
            ))
        if self.eos_sync_all:
            urls.append(path(
                f'sync-eos-all-{model_name}/',
                self.admin_site.admin_view(self.sync_eos_all_view),
                name=f'sync-eos-all-{model_name}',
            ))
        return urls

    def _report(self, request, stats_list):
        for stats in stats_list:
            level = messages.SUCCESS if stats.ok else messages.WARNING
            self.message_user(request, stats.as_message(), level)
            for err in stats.errors[:15]:
                self.message_user(request, f"{stats.entity}: {err}", messages.ERROR)

    def sync_eos_view(self, request):
        """Синхронизировать текущую таблицу из ЭОС и вернуться к списку."""
        if not self.eos_syncer_class:
            self.message_user(request, "Синхронизатор не настроен", messages.ERROR)
            return redirect("..")
        try:
            self._report(request, [self.eos_syncer_class().run()])
        except Exception as e:
            self.message_user(request, f"Ошибка синхронизации с ЭОС: {e}", messages.ERROR)
        return redirect("..")

    def sync_eos_all_view(self, request):
        """Синхронизировать всю структуру (факультеты → кафедры → группы) из ЭОС."""
        try:
            self._report(request, syncers.run_all())
        except Exception as e:
            self.message_user(request, f"Ошибка синхронизации с ЭОС: {e}", messages.ERROR)
        return redirect("..")

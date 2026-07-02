from django.contrib import admin, messages
from django.contrib.admin import helpers
from django.shortcuts import redirect

from . import syncers


class EosSyncActionsMixin:
    """
    Действия django-admin (в селекторе "Действие", рядом с "Удалить выбранные):
        - "Импорт из CSV": редирект на форму выбора файла;
        - "Обновить из ЭОС": self.eos_syncer_class;
        - "Обновить ВСЁ из ЭОС": синхронизация всей структуры (facultie's - department's - group's).
    """
    eos_syncer_class = None
    # действия, которым не нужен выбор строк
    no_selection_actions = ("import_csv_action", "sync_eos_action", "sync_eos_all_action")

    def changelist_view(self, request, extra_context=None):
        if request.method == "POST" and request.POST.get("action") in self.no_selection_actions:
            if not request.POST.getlist(helpers.ACTION_CHECKBOX_NAME):
                post = request.POST.copy()
                post.setlist(helpers.ACTION_CHECKBOX_NAME, ["0"])
                request.POST = post
        return super().changelist_view(request, extra_context)

    def _report(self, request, stats_list):
        for stats in stats_list:
            level = messages.SUCCESS if stats.ok else messages.WARNING
            self.message_user(request, stats.as_message(), level)
            for err in stats.errors[:15]:
                self.message_user(request, f"{stats.entity}: {err}", messages.ERROR)

    @admin.action(description="Импорт из CSV")
    def import_csv_action(self, request, queryset):
        return redirect(f"import-{self.model._meta.model_name}/")

    @admin.action(description="Обновить из ЭОС")
    def sync_eos_action(self, request, queryset):
        if not self.eos_syncer_class:
            self.message_user(request, "Синхронизатор не настроен", messages.ERROR)
            return
        try:
            self._report(request, [self.eos_syncer_class().run()])
        except Exception as e:
            self.message_user(request, f"Ошибка синхронизации с ЭОС: {e}", messages.ERROR)

    @admin.action(description="Обновить ВСЁ из ЭОС (структура)")
    def sync_eos_all_action(self, request, queryset):
        try:
            self._report(request, syncers.run_all())
        except Exception as e:
            self.message_user(request, f"Ошибка синхронизации с ЭОС: {e}", messages.ERROR)

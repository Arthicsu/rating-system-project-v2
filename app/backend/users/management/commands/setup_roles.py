from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from students.models import Student, Document

class Command(BaseCommand):
    help = 'Инициализация групп пользователей и базовых прав'

    def handle(self, *args, **kwargs):
        roles = ['Student', 'Department', 'Dean', 'Rectorate']
        
        student_ct = ContentType.objects.get_for_model(Student)
        document_ct = ContentType.objects.get_for_model(Document)

        for role_name in roles:
            group, created = Group.objects.get_or_create(name=role_name)
            if created:
                self.stdout.write(f'Группа "{role_name}" создана.')

            if role_name == 'Student':
                perms = Permission.objects.filter(content_type=document_ct, codename__in=['add_document', 'view_document'])
                group.permissions.set(perms)
            
            elif role_name in ['Department', 'Dean', 'Rectorate']:
                perms = Permission.objects.filter(content_type=student_ct, codename='view_student')
                doc_perms = Permission.objects.filter(content_type=document_ct, codename__in=['view_document', 'change_document'])
                group.permissions.set(list(perms) + list(doc_perms))

        self.stdout.write(self.style.SUCCESS('Роли успешно настроены!'))
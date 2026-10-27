"""
Группа, где остались только архивные студенты (выпустилась, отчислена целиком), пропадает из
списка групп кабинета и из фильтров рейтинга. Связь студента с группой при этом сохраняется.
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import TEST_SETTINGS, make_department, make_group, make_staff, make_student


@override_settings(**TEST_SETTINGS)
class ActiveGroupsTests(APITestCase):
    def setUp(self):
        cache.clear()
        department = make_department("К1")
        self.live = make_group(department, "ИВТ-101")
        self.graduated = make_group(department, "ИВТ-401", course=4)
        make_student("live@uni.ru", group=self.live)
        make_student("live-old@uni.ru", group=self.live, archived=True)
        make_student("grad@uni.ru", group=self.graduated, archived=True)
        self.client.force_authenticate(make_staff("rector", "Rectorate"))

    def test_group_with_only_archived_hidden_in_groups(self):
        names = {g["name"] for g in self.client.get(reverse("api:groups-list")).data}

        self.assertEqual(names, {"ИВТ-101"})

    def test_group_with_only_archived_hidden_in_rating_filters(self):
        groups = self.client.get(reverse("api:rating-filters")).data["groups"]

        self.assertEqual([g["name"] for g in groups], ["ИВТ-101"])

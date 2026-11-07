"""Unit checks for the Yandex orders handler; no cloud or customer data is used."""
import importlib.util
import json
import os
import pathlib
import sys
import types
import unittest
from unittest import mock

sys.modules.setdefault("ydb", types.ModuleType("ydb"))
module_path = pathlib.Path(__file__).with_name("index.py")
spec = importlib.util.spec_from_file_location("amarket_order_handler_under_test", module_path)
orders = importlib.util.module_from_spec(spec)
spec.loader.exec_module(orders)

ORIGIN = "https://applemarket26.ru"


def event(method="POST", data=None, origin=ORIGIN, headers=None):
    h = {"origin": origin}
    h.update(headers or {})
    result = {"httpMethod": method, "headers": h}
    if data is not None:
        result["body"] = json.dumps(data, ensure_ascii=False)
    return result


def sample_order():
    return {
        "name": "Тестовый клиент",
        "phone": "+70000000000",
        "city": "Ставрополь",
        "contact": "phone",
        "comment": "Тестовая заявка — никаких реальных данных",
        "consent": True,
        "captcha_token": "test-captcha-token",
        "items": [{"id": "test-iphone", "name": "Тестовый товар", "qty": 1, "price": 1}],
    }


class OrdersHandlerTests(unittest.TestCase):
    def test_rejects_unknown_origin(self):
        result = orders.handler(event(origin="https://example.org", data=sample_order()), None)
        self.assertEqual(result["statusCode"], 403)
        self.assertNotIn("Access-Control-Allow-Origin", result["headers"])

    def test_preflight_has_expected_cors(self):
        result = orders.handler(event(method="OPTIONS"), None)
        self.assertEqual(result["statusCode"], 204)
        self.assertEqual(result["headers"]["Access-Control-Allow-Origin"], ORIGIN)

    def test_missing_consent_is_not_saved(self):
        invalid = sample_order()
        invalid["consent"] = False
        with mock.patch.object(orders, "_save_order") as save:
            result = orders.handler(event(data=invalid), None)
        self.assertEqual(result["statusCode"], 400)
        save.assert_not_called()

    def test_invalid_contact_is_not_saved(self):
        invalid = sample_order()
        invalid["phone"] = "not a phone"
        with mock.patch.object(orders, "_save_order") as save:
            result = orders.handler(event(data=invalid), None)
        self.assertEqual(result["statusCode"], 400)
        save.assert_not_called()

    def test_failed_captcha_is_not_saved(self):
        with mock.patch.object(orders, "_captcha_ok", return_value=False), \
                mock.patch.object(orders, "_save_order") as save:
            result = orders.handler(event(data=sample_order()), None)
        self.assertEqual(result["statusCode"], 403)
        save.assert_not_called()

    def test_valid_order_is_saved_and_acknowledged(self):
        with mock.patch.object(orders, "_captcha_ok", return_value=True), \
                mock.patch.object(orders, "_save_order") as save, \
                mock.patch.object(orders, "_telegram_notice") as notify:
            result = orders.handler(event(data=sample_order()), None)
        self.assertEqual(result["statusCode"], 201)
        data = json.loads(result["body"])
        self.assertTrue(data["ok"])
        self.assertRegex(data["order_id"], r"^[0-9]{8}-[A-F0-9]{10}$")
        record = save.call_args.args[0]
        self.assertEqual(record["phone"], "+70000000000")
        self.assertEqual(record["declared_total"], 1)
        self.assertEqual(record["consent_version"], orders.POLICY_VERSION)
        self.assertTrue(record["consent_at"])
        self.assertEqual(notify.call_args.args[0], data["order_id"])
        self.assertNotIn("+70000000000", result["body"])

    def test_admin_access_requires_secure_token(self):
        with mock.patch.dict(os.environ, {"ADMIN_ACCESS_TOKEN": "s" * 48}):
            bad = orders.handler(event(method="GET"), None)
            self.assertEqual(bad["statusCode"], 401)
            with mock.patch.object(orders, "_list_orders", return_value=[]):
                good = orders.handler(event(method="GET", headers={"X-Admin-Token": "s" * 48}), None)
        self.assertEqual(good["statusCode"], 200)
        self.assertEqual(json.loads(good["body"])["orders"], [])

    def test_admin_list_orders_uses_newest_creation_time(self):
        captured = {}

        class Row:
            id = "20261105-TEST"
            created_at = "2026-11-05T14:23:00+00:00"
            customer_name = "Тестовый клиент"
            phone = "+70000000000"
            city = "Ставрополь"
            preferred_contact = "phone"
            comment = "Тестовая заявка"
            items_json = "[]"
            declared_total = 1
            status = "new"

        class Result:
            rows = [Row()]

        class Pool:
            def execute_with_retries(self, query):
                captured["query"] = query
                return [Result()]

        with mock.patch.object(orders, "_db_pool", return_value=Pool()):
            result = orders._list_orders()

        self.assertIn("ORDER BY created_at DESC, id DESC", captured["query"])
        self.assertNotIn("ORDER BY created_at", captured["query"])
        self.assertEqual(result[0]["id"], "20261105-TEST")

    def test_telegram_notice_contains_no_personal_data(self):
        called = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self, count):
                return b'{"ok":true}'

        def fake_urlopen(req, timeout):
            called["payload"] = req.data.decode("utf-8")
            return FakeResponse()

        with mock.patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "dummy", "TELEGRAM_CHAT_ID": "123"}):
            with mock.patch.object(orders.request, "urlopen", side_effect=fake_urlopen):
                orders._telegram_notice("TEST-ORDER-1", 1, 1)
        self.assertIn("TEST-ORDER-1", called["payload"])
        self.assertNotIn("+70000000000", called["payload"])

    def test_telegram_notice_uses_protected_relay(self):
        called = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self, count):
                return b'{"ok":true}'

        def fake_urlopen(req, timeout):
            called["url"] = req.full_url
            called["secret"] = req.headers.get("X-order-notice-secret")
            called["payload"] = json.loads(req.data.decode("utf-8"))
            return FakeResponse()

        env = {
            "TELEGRAM_RELAY_URL": "https://bot.example/api/order-notice",
            "TELEGRAM_RELAY_SECRET": "r" * 48,
        }
        with mock.patch.dict(os.environ, env, clear=False):
            with mock.patch.object(orders.request, "urlopen", side_effect=fake_urlopen):
                orders._telegram_notice("TEST-ORDER-2", 2, 999)
        self.assertEqual(called["url"], env["TELEGRAM_RELAY_URL"])
        self.assertEqual(called["secret"], env["TELEGRAM_RELAY_SECRET"])
        self.assertEqual(called["payload"], {"order_id": "TEST-ORDER-2", "items_count": 2})
        self.assertNotIn("name", called["payload"])
        self.assertNotIn("phone", called["payload"])


if __name__ == "__main__":
    unittest.main()


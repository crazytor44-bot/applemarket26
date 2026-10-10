"""А Маркет: HTTPS-приём заявок. Yandex Cloud Functions (index.handler).

Персональные данные сохраняются только в YDB в российском регионе.
Токен Telegram и данные сервисного аккаунта никогда не передаются в браузер.
"""
import base64
import datetime
import json
import os
import re
import uuid
from urllib import parse, request

import ydb

ALLOWED_ORIGINS = {"https://applemarket26.ru", "https://www.applemarket26.ru"}
MAX_REQUEST_SIZE = 16000
PHONE_RE = re.compile(r"^[+0-9()\s-]{7,25}$")
_driver = None
_pool = None


def _response(status, payload, origin=""):
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
        headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type"
        headers["Access-Control-Max-Age"] = "600"
    return {"statusCode": status, "headers": headers,
            "body": json.dumps(payload, ensure_ascii=False)}


def _clean_string(obj, key, max_len):
    value = obj.get(key, "")
    if not isinstance(value, str):
        raise ValueError("Неверный тип поля " + key)
    value = value.strip()
    if len(value) > max_len:
        raise ValueError("Слишком длинное поле " + key)
    return value


def _parse(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body, validate=True).decode("utf-8")
    if not isinstance(body, str) or len(body.encode("utf-8")) > MAX_REQUEST_SIZE:
        raise ValueError("Слишком большой запрос")
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("Некорректные данные")
    # Поле-ловушка для простых автоматических отправок.
    if data.get("website"):
        raise ValueError("Некорректные данные")
    name = _clean_string(data, "name", 80)
    phone = _clean_string(data, "phone", 25)
    city = _clean_string(data, "city", 100)
    contact = _clean_string(data, "contact", 40)
    comment = _clean_string(data, "comment", 1000)
    if len(name) < 2 or not PHONE_RE.fullmatch(phone):
        raise ValueError("Проверьте имя и номер телефона")
    items = data.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 25:
        raise ValueError("Корзина пуста или содержит слишком много товаров")
    clean_items = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Неверный товар")
        item_name = _clean_string(item, "name", 180)
        item_id = _clean_string(item, "id", 160)
        qty, price = item.get("qty"), item.get("price")
        if (not item_name or not isinstance(qty, int) or isinstance(qty, bool)
                or not 1 <= qty <= 20 or not isinstance(price, int)
                or isinstance(price, bool) or not 0 < price <= 5000000):
            raise ValueError("Неверные параметры товара")
        clean_items.append({"id": item_id, "name": item_name,
                            "qty": qty, "price": price})
    total = sum(x["price"] * x["qty"] for x in clean_items)
    return name, phone, city, contact, comment, clean_items, total


def _db_pool():
    global _driver, _pool
    if _pool is None:
        _driver = ydb.Driver(
            endpoint=os.environ["YDB_ENDPOINT"],
            database=os.environ["YDB_DATABASE"],
            credentials=ydb.iam.MetadataUrlCredentials(),
        )
        _driver.wait(fail_fast=True, timeout=7)
        _pool = ydb.SessionPool(_driver)
    return _pool


def _save_order(record):
    query = """
    DECLARE $id AS Utf8;
    DECLARE $created_at AS Utf8;
    DECLARE $customer_name AS Utf8;
    DECLARE $phone AS Utf8;
    DECLARE $city AS Utf8;
    DECLARE $preferred_contact AS Utf8;
    DECLARE $comment AS Utf8;
    DECLARE $items_json AS Utf8;
    DECLARE $declared_total AS Uint64;
    DECLARE $status AS Utf8;
    UPSERT INTO orders
      (id, created_at, customer_name, phone, city, preferred_contact,
       comment, items_json, declared_total, status)
    VALUES
      ($id, $created_at, $customer_name, $phone, $city, $preferred_contact,
       $comment, $items_json, $declared_total, $status);
    """
    params = {"$" + k: v for k, v in record.items()}

    def write(session):
        session.transaction().execute(query, params, commit_tx=True)

    _db_pool().retry_operation_sync(write)


def _telegram_notice(order_id, items_count, total):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return
    # В Telegram НЕ отправляем имя, телефон, комментарий или ссылку с ПДн.
    msg = ("🛒 А Маркет — новая заявка\n"
           "Номер: " + order_id + "\n"
           "Позиций: " + str(items_count) + "\n"
           "Сумма по заявке: " + str(total) + " ₽\n"
           "Данные покупателя — в защищённой базе YDB.")
    data = parse.urlencode({"chat_id": chat_id, "text": msg}).encode("utf-8")
    with request.urlopen(
        request.Request("https://api.telegram.org/bot" + token + "/sendMessage",
                        data=data, method="POST"),
        timeout=5,
    ) as r:
        r.read(1024)


def handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")
    method = (event.get("httpMethod") or "").upper()

    if origin not in ALLOWED_ORIGINS:
        return _response(403, {"error": "Недопустимый источник"})
    if method == "OPTIONS":
        return _response(204, {}, origin)
    if method != "POST":
        return _response(405, {"error": "Используйте POST"}, origin)

    try:
        name, phone, city, contact, comment, items, total = _parse(event)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError,
            base64.binascii.Error):
        return _response(400, {"error": "Проверьте данные заказа"}, origin)

    order_id = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d") + "-" + uuid.uuid4().hex[:10].upper()
    record = {
        "id": order_id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "customer_name": name,
        "phone": phone,
        "city": city,
        "preferred_contact": contact,
        "comment": comment,
        "items_json": json.dumps(items, ensure_ascii=False),
        "declared_total": total,
        "status": "new",
    }
    try:
        _save_order(record)
    except Exception:
        # Не логируем тело запроса или ПДн клиента.
        return _response(503, {"error": "Не удалось сохранить заявку. Попробуйте позднее."}, origin)

    try:
        _telegram_notice(order_id, len(items), total)
    except Exception:
        # Заявка уже сохранена: ошибка Telegram не должна вводить клиента в заблуждение.
        pass
    return _response(201, {"ok": True, "order_id": order_id}, origin)

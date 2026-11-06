"""А Маркет: HTTPS-приём заявок. Yandex Cloud Functions (index.handler).

Персональные данные сохраняются только в YDB в российском регионе.
Секреты передаются функции только из Yandex Lockbox.
"""
import base64
import datetime
import json
import hashlib
import hmac
import os
import re
import uuid
from urllib import parse, request

import ydb

ALLOWED_ORIGINS = {"https://applemarket26.ru", "https://www.applemarket26.ru"}
ALLOWED_CAPTCHA_HOSTS = {"applemarket26.ru", "www.applemarket26.ru"}
MAX_REQUEST_SIZE = 16000
PHONE_RE = re.compile(r"^[+0-9()\s-]{7,25}$")
POLICY_VERSION = "2026-11-04"
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
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Token"
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
    if data.get("website"):
        raise ValueError("Некорректные данные")
    if data.get("consent") is not True:
        raise ValueError("Требуется согласие")
    name = _clean_string(data, "name", 80)
    phone = _clean_string(data, "phone", 25)
    city = _clean_string(data, "city", 100)
    contact = _clean_string(data, "contact", 40)
    comment = _clean_string(data, "comment", 1000)
    captcha_token = _clean_string(data, "captcha_token", 8192)
    if len(name) < 2 or not PHONE_RE.fullmatch(phone):
        raise ValueError("Проверьте имя и номер телефона")
    if os.environ.get("CAPTCHA_REQUIRED", "1") != "0" and len(captcha_token) < 10:
        raise ValueError("Требуется проверка")
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
    return name, phone, city, contact, comment, clean_items, total, captcha_token


def _source_ip(event):
    context = event.get("requestContext") or {}
    identity = context.get("identity") or {}
    value = identity.get("sourceIp") or ""
    if not value:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        value = (headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    return value if isinstance(value, str) and len(value) <= 64 else ""


def _captcha_ok(event, token):
    if os.environ.get("CAPTCHA_REQUIRED", "1") == "0":
        return True
    secret = os.environ.get("SMARTCAPTCHA_SERVER_KEY", "")
    if not secret or not token:
        return False
    data = {"secret": secret, "token": token}
    source_ip = _source_ip(event)
    if source_ip:
        data["ip"] = source_ip
    req = request.Request(
        "https://smartcaptcha.cloud.yandex.ru/validate",
        data=parse.urlencode(data).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with request.urlopen(req, timeout=4) as response:
            result = json.loads(response.read(4096).decode("utf-8"))
    except Exception:
        return False
    return (result.get("status") == "ok"
            and result.get("host") in ALLOWED_CAPTCHA_HOSTS)


def _db_pool():
    global _driver, _pool
    if _pool is None:
        _driver = ydb.Driver(
            endpoint=os.environ["YDB_ENDPOINT"],
            database=os.environ["YDB_DATABASE"],
            credentials=ydb.iam.MetadataUrlCredentials(),
        )
        _driver.wait(fail_fast=True, timeout=7)
        _pool = ydb.QuerySessionPool(_driver)
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
    DECLARE $consent_version AS Utf8;
    DECLARE $consent_at AS Utf8;
    UPSERT INTO orders
      (id, created_at, customer_name, phone, city, preferred_contact,
       comment, items_json, declared_total, status, consent_version, consent_at)
    VALUES
      ($id, $created_at, $customer_name, $phone, $city, $preferred_contact,
       $comment, $items_json, $declared_total, $status, $consent_version, $consent_at);
    """
    params = {
        "$" + k: ydb.TypedValue(
            v,
            ydb.PrimitiveType.Uint64
            if k == "declared_total"
            else ydb.PrimitiveType.Utf8,
        )
        for k, v in record.items()
    }

    _db_pool().execute_with_retries(query, params)


def _telegram_notice(order_id, items_count, total):
    relay_url = os.environ.get("TELEGRAM_RELAY_URL", "").strip()
    relay_secret = os.environ.get("TELEGRAM_RELAY_SECRET", "")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if relay_url and len(relay_secret) < 32 and token:
        relay_secret = hashlib.sha256(
            ("amarket-order-relay-v1:" + token).encode("utf-8")
        ).hexdigest()
    if relay_url and len(relay_secret) >= 32:
        payload = json.dumps({
            "order_id": order_id,
            "items_count": items_count,
        }).encode("utf-8")
        req = request.Request(
            relay_url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Order-Notice-Secret": relay_secret,
            },
        )
        with request.urlopen(req, timeout=5) as response:
            response.read(1024)
        return
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return
    msg = (f"🛒 А Маркет — новая заявка с сайта № {order_id}\n"
           f"Товарных позиций: {items_count}\n"
           "Контактные данные покупателя доступны только в закрытом кабинете:\n"
           "https://applemarket26.ru/orders-admin/")
    data = parse.urlencode({"chat_id": chat_id, "text": msg}).encode("utf-8")
    with request.urlopen(
        request.Request("https://api.telegram.org/bot" + token + "/sendMessage",
                        data=data, method="POST"),
        timeout=5,
    ) as response:
        response.read(1024)



def _row_value(row, name, default=""):
    """Read a YDB result value across SDK row representations."""
    try:
        value = getattr(row, name)
    except (AttributeError, KeyError):
        try:
            value = row[name]
        except (KeyError, TypeError, IndexError):
            return default
    return default if value is None else value


def _list_orders():
    query = """
    SELECT id, created_at, customer_name, phone, city, preferred_contact,
           comment, items_json, declared_total, status
    FROM orders
    ORDER BY id DESC
    LIMIT 100;
    """

    result_sets = _db_pool().execute_with_retries(query)
    orders = []
    for result in result_sets:
        for row in result.rows:
            try:
                items = json.loads(_row_value(row, "items_json", "[]"))
            except (ValueError, TypeError):
                items = []
            orders.append({
                "id": _row_value(row, "id"),
                "created_at": _row_value(row, "created_at"),
                "name": _row_value(row, "customer_name"),
                "phone": _row_value(row, "phone"),
                "city": _row_value(row, "city"),
                "contact": _row_value(row, "preferred_contact"),
                "comment": _row_value(row, "comment"),
                "items": items,
                "total": int(_row_value(row, "declared_total", 0)),
                "status": _row_value(row, "status"),
            })
    return orders


def handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")
    method = (event.get("httpMethod") or "").upper()

    if origin not in ALLOWED_ORIGINS:
        return _response(403, {"error": "Недопустимый источник"})
    if method == "OPTIONS":
        return _response(204, {}, origin)
    if method == "GET":
        configured = os.environ.get("ADMIN_ACCESS_TOKEN", "")
        provided = headers.get("x-admin-token", "")
        if len(configured) < 32 or not hmac.compare_digest(provided, configured):
            return _response(401, {"error": "Доступ запрещён"}, origin)
        try:
            return _response(200, {"ok": True, "orders": _list_orders()}, origin)
        except Exception as exc:
            return _response(
                503,
                {
                    "error": "Не удалось загрузить заявки",
                    "diagnostic": type(exc).__name__,
                },
                origin,
            )
    if method != "POST":
        return _response(405, {"error": "Используйте GET или POST"}, origin)

    try:
        name, phone, city, contact, comment, items, total, captcha_token = _parse(event)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError,
            base64.binascii.Error):
        return _response(400, {"error": "Проверьте данные заказа"}, origin)

    if not _captcha_ok(event, captcha_token):
        return _response(403, {"error": "Не пройдена проверка безопасности"}, origin)

    now = datetime.datetime.now(datetime.timezone.utc)
    order_id = now.strftime("%Y%m%d") + "-" + uuid.uuid4().hex[:10].upper()
    record = {
        "id": order_id,
        "created_at": now.isoformat(),
        "customer_name": name,
        "phone": phone,
        "city": city,
        "preferred_contact": contact,
        "comment": comment,
        "items_json": json.dumps(items, ensure_ascii=False),
        "declared_total": total,
        "status": "new",
        "consent_version": POLICY_VERSION,
        "consent_at": now.isoformat(),
    }
    try:
        _save_order(record)
    except Exception:
        return _response(503, {"error": "Не удалось сохранить заявку. Попробуйте позднее."}, origin)

    try:
        _telegram_notice(order_id, len(items), total)
    except Exception:
        pass
    return _response(201, {"ok": True, "order_id": order_id}, origin)


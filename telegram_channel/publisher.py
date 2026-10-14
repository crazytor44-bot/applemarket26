#!/usr/bin/env python3
"""Manage @applemarket26 using a dedicated Telegram bot (no personal account session)."""
import argparse
import io
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CHAT = "@applemarket26"
TITLE = "А Маркет | Техника и ремонт"
DESCRIPTION = (
    "📱 А Маркет — магазин техники в Ставрополе\n"
    "🍎 iPhone, Samsung, Xiaomi и другая техника\n"
    "🛠 Ремонт смартфонов\n"
    "♻️ Обмен и выкуп\n"
    "💳 Рассрочка\n"
    "📍 Ставрополь, ул. Тухачевского, 16\n"
    "🕘 Ежедневно 9:00–20:00\n"
    "🌐 applemarket26.ru\n"
    "📲 +7 938 311-98-88"
)


def telegram(method: str, payload: dict | None = None) -> object:
    token = os.environ.get("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Добавьте GitHub Actions secret AMARKET_TELEGRAM_BOT_TOKEN")
    data = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=25) as response:
            result = json.load(response)
    except HTTPError as exc:
        # Never log the request URL: it contains the Telegram bot token.
        try:
            message = json.load(exc).get("description", "Telegram API error")
        except (ValueError, OSError):
            message = "Telegram API error"
        raise RuntimeError(f"{method}: {message}") from None
    except URLError as exc:
        raise RuntimeError(f"{method}: Telegram недоступен ({exc.reason})") from None
    if not result.get("ok"):
        raise RuntimeError(f"{method}: {result.get('description', 'Telegram API error')}")
    return result["result"]


def verify(*, change_info: bool = False, post_messages: bool = False, pin_messages: bool = False) -> None:
    chat = telegram("getChat", {"chat_id": CHAT})
    if chat.get("type") != "channel":
        raise RuntimeError("Указанный Telegram ID не является каналом")
    me = telegram("getMe")
    membership = telegram("getChatMember", {"chat_id": CHAT, "user_id": me["id"]})
    if membership.get("status") not in {"administrator", "creator"}:
        raise RuntimeError("Добавьте бота администратором канала @applemarket26")
    if post_messages and not membership.get("can_post_messages", False):
        raise RuntimeError("Боту не выданы права «Публиковать сообщения»")
    if pin_messages and not membership.get("can_edit_messages", False):
        raise RuntimeError("Для закрепления сообщений предоставьте боту право «Редактировать сообщения» в канале")
    if change_info and not membership.get("can_change_info", False):
        raise RuntimeError("Боту не выданы права «Изменять информацию канала»")
    print(f"Канал: {chat.get('title')} ({CHAT}); бот: @{me.get('username')}; доступ подтвержден")


def rebrand() -> None:
    verify(change_info=True)
    telegram("setChatTitle", {"chat_id": CHAT, "title": TITLE})
    telegram("setChatDescription", {"chat_id": CHAT, "description": DESCRIPTION})
    print("Название и описание канала обновлены; username и подписчики сохранены.")



def set_channel_avatar() -> None:
    """Upload the existing AMarket logo from the site as channel avatar."""
    verify(change_info=True)
    filename = Path("favicon-256.png")
    photo = filename.read_bytes()
    if not photo.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("Не найден ожидаемый PNG логотип favicon-256.png")
    if len(photo) > 10_000_000:
        raise RuntimeError("Логотип слишком большой")
    token = os.environ.get("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    boundary = "amarket-telegram-avatar-upload"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
        f"{CHAT}\r\n"
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="photo"; filename="amarket-logo.png"\r\n'
        "Content-Type: image/png\r\n\r\n"
    ).encode("utf-8") + photo + f"\r\n--{boundary}--\r\n".encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{token}/setChatPhoto",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=35) as response:
            result = json.load(response)
    except HTTPError as exc:
        try:
            message = json.load(exc).get("description", "Ошибка Telegram API")
        except (ValueError, OSError):
            message = "Ошибка Telegram API"
        raise RuntimeError(f"setChatPhoto: {message}") from None
    except URLError as exc:
        raise RuntimeError(f"setChatPhoto: Telegram недоступен ({exc.reason})") from None
    if not result.get("ok"):
        raise RuntimeError(f"setChatPhoto: {result.get('description', 'Ошибка Telegram API')}")
    print("Аватарка канала обновлена: оригинальный логотип AM из favicon-256.png.")


def send_storefront_photo(caption: str, *, parse_mode: str) -> dict:
    """Convert our verified storefront WEBP to JPEG and send it as a Telegram photo."""
    from PIL import Image

    image_path = Path("assets/amarket-storefront.webp")
    if not image_path.is_file():
        raise RuntimeError("Не найдена фотография магазина assets/amarket-storefront.webp")
    with Image.open(image_path) as im:
        if im.format != "WEBP":
            raise RuntimeError("Фотография магазина имеет неожиданный формат")
        im = im.convert("RGB")
        im.thumbnail((1600, 1600))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=91, optimize=True)
        jpeg = buf.getvalue()

    token = os.environ.get("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    boundary = "amarket-approved-storefront-photo"
    parts = bytearray()

    def field(name: str, value: str) -> None:
        parts.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode("utf-8"))

    field("chat_id", CHAT)
    field("caption", caption)
    if parse_mode == "HTML":
        field("parse_mode", "HTML")
    parts.extend(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"amarket-storefront.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode("utf-8")
    )
    parts.extend(jpeg)
    parts.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    request = Request(
        f"https://api.telegram.org/bot{token}/sendPhoto",
        data=bytes(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            response_data = json.load(response)
    except HTTPError as exc:
        try:
            message = json.load(exc).get("description", "Ошибка отправки фотографии")
        except (ValueError, OSError):
            message = "Ошибка отправки фотографии"
        # Never log the URL: it includes the bot token.
        raise RuntimeError(f"sendPhoto: {message}") from None
    except URLError as exc:
        raise RuntimeError(f"sendPhoto: Telegram недоступен ({exc.reason})") from None
    if not response_data.get("ok"):
        raise RuntimeError(f"sendPhoto: {response_data.get('description', 'Ошибка Telegram API')}")
    return response_data["result"]


def publish(path: str) -> None:
    if not path.startswith("telegram_channel/approved/") or not path.endswith(".json"):
        raise RuntimeError("Разрешены только файлы telegram_channel/approved/*.json")
    post = json.loads(Path(path).read_text(encoding="utf-8"))
    body = post.get("text")
    if not isinstance(body, str) or not body.strip():
        raise RuntimeError("В одобренном посте нет текста")
    if post.get("parse_mode", "HTML") not in {"HTML", "plain"}:
        raise RuntimeError("Допустимые parse_mode: HTML или plain")
    parse_mode = post.get("parse_mode", "HTML")
    pin = post.get("pin", False)
    replace_pins = post.get("replace_pins", False)
    if not isinstance(pin, bool) or not isinstance(replace_pins, bool):
        raise RuntimeError("pin и replace_pins должны быть true или false")
    if replace_pins and not pin:
        raise RuntimeError("replace_pins требует pin=true")
    verify(post_messages=True, pin_messages=pin)
    common = {"chat_id": CHAT}
    if parse_mode == "HTML":
        common["parse_mode"] = "HTML"
    photo_path = post.get("photo_repository_path")
    photo = post.get("photo_url")
    if photo and photo_path:
        raise RuntimeError("Укажите только один источник фотографии")
    if photo_path:
        if photo_path != "assets/amarket-storefront.webp":
            raise RuntimeError("Разрешена только проверенная фотография магазина")
        if len(body) > 1024:
            raise RuntimeError("Текст для фото должен быть не длиннее 1024 символов")
        result = send_storefront_photo(body, parse_mode=parse_mode)
    elif photo:
        if not isinstance(photo, str) or not photo.startswith("https://"):
            raise RuntimeError("photo_url должен быть публичной ссылкой https://")
        if len(body) > 1024:
            raise RuntimeError("Текст для фото должен быть не длиннее 1024 символов")
        result = telegram("sendPhoto", {**common, "photo": photo, "caption": body})
    else:
        if len(body) > 4096:
            raise RuntimeError("Текст поста должен быть не длиннее 4096 символов")
        result = telegram(
            "sendMessage",
            {**common, "text": body, "link_preview_options": {"is_disabled": True}},
        )
    message_id = result["message_id"]
    print(f"Опубликовано: https://t.me/applemarket26/{message_id}")
    if pin:
        if replace_pins:
            telegram("unpinAllChatMessages", {"chat_id": CHAT})
            print("Предыдущие закрепления сняты; старые сообщения сохранены.")
        telegram("pinChatMessage", {"chat_id": CHAT, "message_id": message_id, "disable_notification": True})
        print(f"Закреплено: https://t.me/applemarket26/{message_id}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check", help="Проверить подключение бота (без публикации)")
    sub.add_parser("brand", help="Переименовать канал и обновить описание")
    sub.add_parser("avatar", help="Поставить фирменный логотип AM в аватар канала")
    pub = sub.add_parser("post", help="Опубликовать одобренный пост")
    pub.add_argument("path")
    args = parser.parse_args()
    if args.command == "check":
        verify(post_messages=True)
    elif args.command == "brand":
        rebrand()
    elif args.command == "avatar":
        set_channel_avatar()
    elif args.command == "post":
        publish(args.path)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError) as exc:
        raise SystemExit(f"Ошибка: {exc}") from None

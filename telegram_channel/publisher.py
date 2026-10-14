#!/usr/bin/env python3
"""Manage @applemarket26 using a dedicated Telegram bot (no personal account session)."""
import argparse
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


def verify(*, change_info: bool = False, post_messages: bool = False) -> None:
    chat = telegram("getChat", {"chat_id": CHAT})
    if chat.get("type") != "channel":
        raise RuntimeError("Указанный Telegram ID не является каналом")
    me = telegram("getMe")
    membership = telegram("getChatMember", {"chat_id": CHAT, "user_id": me["id"]})
    if membership.get("status") not in {"administrator", "creator"}:
        raise RuntimeError("Добавьте бота администратором канала @applemarket26")
    if post_messages and not membership.get("can_post_messages", False):
        raise RuntimeError("Боту не выданы права «Публиковать сообщения»")
    if change_info and not membership.get("can_change_info", False):
        raise RuntimeError("Боту не выданы права «Изменять информацию канала»")
    print(f"Канал: {chat.get('title')} ({CHAT}); бот: @{me.get('username')}; доступ подтвержден")


def rebrand() -> None:
    verify(change_info=True)
    telegram("setChatTitle", {"chat_id": CHAT, "title": TITLE})
    telegram("setChatDescription", {"chat_id": CHAT, "description": DESCRIPTION})
    print("Название и описание канала обновлены; username и подписчики сохранены.")


def publish(path: str) -> None:
    if not path.startswith("telegram_channel/approved/") or not path.endswith(".json"):
        raise RuntimeError("Разрешены только файлы telegram_channel/approved/*.json")
    verify(post_messages=True)
    post = json.loads(Path(path).read_text(encoding="utf-8"))
    body = post.get("text")
    if not isinstance(body, str) or not body.strip():
        raise RuntimeError("В одобренном посте нет текста")
    if post.get("parse_mode", "HTML") not in {"HTML", "plain"}:
        raise RuntimeError("Допустимые parse_mode: HTML или plain")
    parse_mode = post.get("parse_mode", "HTML")
    common = {"chat_id": CHAT}
    if parse_mode == "HTML":
        common["parse_mode"] = "HTML"
    photo = post.get("photo_url")
    if photo:
        if not isinstance(photo, str) or not photo.startswith("https://"):
            raise RuntimeError("photo_url должен быть публичной ссылкой https://")
        if len(body) > 1024:
            raise RuntimeError("Для поста с фотографией текст должен быть не длиннее 1024 символов")
        result = telegram("sendPhoto", {**common, "photo": photo, "caption": body})
    else:
        if len(body) > 4096:
            raise RuntimeError("Текст поста должен быть не длиннее 4096 символов")
        result = telegram(
            "sendMessage",
            {**common, "text": body, "link_preview_options": {"is_disabled": True}},
        )
    print(f"Опубликовано: https://t.me/applemarket26/{result['message_id']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check", help="Проверить подключение бота (без публикации)")
    sub.add_parser("brand", help="Переименовать канал и обновить описание")
    pub = sub.add_parser("post", help="Опубликовать одобренный пост")
    pub.add_argument("path")
    args = parser.parse_args()
    if args.command == "check":
        verify(post_messages=True)
    elif args.command == "brand":
        rebrand()
    elif args.command == "post":
        publish(args.path)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError) as exc:
        raise SystemExit(f"Ошибка: {exc}") from None

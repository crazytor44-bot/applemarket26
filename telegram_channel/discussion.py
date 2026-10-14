#!/usr/bin/env python3
"""Safely brand ONLY the discussion group linked to channel @applemarket26."""
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from publisher import telegram

CHANNEL = "@applemarket26"
NEW_TITLE = "А Маркет | Общение 💬"
NEW_DESCRIPTION = (
    "💬 Чат магазина «А Маркет».\n"
    "📱 Обсуждаем технику, ремонт, обмен и выкуп.\n"
    "📍 Ставрополь, Тухачевского, 16\n"
    "🌐 applemarket26.ru\n\n"
    "🤝 Без спама, рекламы, оскорблений и подозрительных ссылок. "
    "Не публикуйте личные данные."
)
ALLOWED_OLD_TITLES = (
    "Apple Market 26 Chat",
    "А Маркет | Общение 💬",
)


def discussion_id_and_admin() -> int:
    main = telegram("getChat", {"chat_id": CHANNEL})
    if main.get("type") != "channel":
        raise RuntimeError("Не удалось проверить канал А Маркет")
    linked = main.get("linked_chat_id")
    if not isinstance(linked, int):
        raise RuntimeError("У канала @applemarket26 не обнаружен привязанный чат. Ничего не меняем.")
    group = telegram("getChat", {"chat_id": linked})
    if group.get("type") not in ("supergroup", "group"):
        raise RuntimeError("Привязанный чат не является группой Telegram")
    if group.get("title") not in ALLOWED_OLD_TITLES:
        raise RuntimeError(
            "Название привязанного чата отличается от ожидаемого — "
            "во избежание ошибки ничего не меняем."
        )
    me = telegram("getMe")
    admin = telegram("getChatMember", {"chat_id": linked, "user_id": me["id"]})
    if admin.get("status") not in {"administrator", "creator"}:
        raise RuntimeError(
            "Бот @amarket26_bot пока не администратор привязанного чата."
        )
    if admin.get("status") != "creator" and not admin.get("can_change_info", False):
        raise RuntimeError(
            "Боту не выданы права «Изменять информацию группы». "
            "Дайте это право в списке администраторов чата."
        )
    print(
        f"Проверено: привязанный чат «{group['title']}»; "
        "права бота на изменение оформления подтверждены."
    )
    print(
        "Права модерации: удалять сообщения — "
        + ("да" if admin.get("can_delete_messages", False) else "нет")
    )
    return linked


def set_group_photo(group_id: int) -> None:
    photo = Path("favicon-256.png").read_bytes()
    if not photo.startswith(b"\x89PNG\r\n\x1a\n") or len(photo) > 10_000_000:
        raise RuntimeError("Фирменный логотип favicon-256.png отсутствует или повреждён")
    token = os.environ.get("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    boundary = "amarket-discussion-photo"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
        f"{group_id}\r\n"
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="photo"; filename="amarket-logo.png"\r\n'
        "Content-Type: image/png\r\n\r\n"
    ).encode("utf-8") + photo + f"\r\n--{boundary}--\r\n".encode("utf-8")
    req = Request(
        f"https://api.telegram.org/bot{token}/setChatPhoto",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=35) as response:
            data = json.load(response)
    except HTTPError as exc:
        try:
            err = json.load(exc).get("description", "Ошибка Telegram")
        except (ValueError, OSError):
            err = "Ошибка Telegram"
        # Do not output URL containing bot token.
        raise RuntimeError(f"setChatPhoto: {err}") from None
    except URLError:
        raise RuntimeError("Не удалось подключиться к Telegram для смены аватара") from None
    if not data.get("ok"):
        raise RuntimeError("Telegram отклонил смену аватара")
    print("Фото чата заменено на оригинальный логотип А Маркет.")


def main() -> None:
    group_id = discussion_id_and_admin()
    telegram("setChatTitle", {"chat_id": group_id, "title": NEW_TITLE})
    print("Чат переименован: " + NEW_TITLE)
    telegram("setChatDescription", {"chat_id": group_id, "description": NEW_DESCRIPTION})
    print("Описание чата обновлено.")
    set_group_photo(group_id)
    print("Готово. Привязка к каналу сохранена, обсуждения и сообщения не удалены.")
    print("Автоматическая модерация и ограничения пользователей не включены.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError, FileNotFoundError) as exc:
        raise SystemExit(f"Ошибка: {exc}") from None

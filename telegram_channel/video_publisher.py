#!/usr/bin/env python3
"""Publish an explicitly approved A Market video once via a bot, never via a personal account.

Use only with newly added telegram_channel/video_approved/*.json files.
"""
import hashlib
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from publisher import CHAT, verify

EXPECTED_FILENAME = "iphone-15-pro-telegram.mp4"
EXPECTED_SHA256 = "f0d52b30fb2327a1dbbb0c17c8676ee541e73392eb239989ab3c68e51a0f5f99"


def publish_approved_video(approval_file: str, video_file: str) -> None:
    approved = Path(approval_file)
    if not approval_file.startswith("telegram_channel/video_approved/") or not approval_file.endswith(".json"):
        raise RuntimeError("Разрешена публикация только из video_approved/*.json")
    if not approved.is_file():
        raise RuntimeError("Отсутствует подтвержденный JSON")
    post = json.loads(approved.read_text(encoding="utf-8"))
    caption = post.get("text")
    if not isinstance(caption, str) or not caption.strip() or len(caption) > 1024:
        raise RuntimeError("Подпись отсутствует или длиннее 1024 символов")
    if post.get("parse_mode") != "plain" or post.get("pin") is not False:
        raise RuntimeError("Ожидается простая подпись без закрепления")
    if post.get("video_sha256") != EXPECTED_SHA256:
        raise RuntimeError("Неожиданный SHA256 одобренного видео")
    if post.get("video_filename") != EXPECTED_FILENAME:
        raise RuntimeError("Неожиданное имя видео")

    path = Path(video_file)
    if not path.is_file() or path.name != EXPECTED_FILENAME:
        raise RuntimeError("Не найден ожидаемый оригинальный ролик")
    payload = path.read_bytes()
    if hashlib.sha256(payload).hexdigest() != EXPECTED_SHA256:
        raise RuntimeError("Хеш видео не совпадает с одобренным файлом")
    if not (1_000_000 < len(payload) < 50_000_000):
        raise RuntimeError("Размер видео вне допустимых границ")
    verify(post_messages=True)

    token = os.environ.get("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Не задан secret AMARKET_TELEGRAM_BOT_TOKEN")
    boundary = "amarket-video-" + uuid4().hex
    body = bytearray()

    def field(name: str, value: str) -> None:
        body.extend(
            (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n").encode("utf-8")
        )

    field("chat_id", CHAT)
    field("caption", caption)
    field("supports_streaming", "true")
    body.extend(
        (f"--{boundary}\r\n"
         f"Content-Disposition: form-data; name=\"video\"; filename=\"{EXPECTED_FILENAME}\"\r\n"
         "Content-Type: video/mp4\r\n\r\n").encode("utf-8")
    )
    body.extend(payload)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    req = Request(
        f"https://api.telegram.org/bot{token}/sendVideo",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=120) as response:
            result = json.load(response)
    except HTTPError as exc:
        try:
            desc = json.load(exc).get("description", "Ошибка API Telegram")
        except (ValueError, OSError):
            desc = "Ошибка API Telegram"
        raise RuntimeError(f"sendVideo: {desc}") from None
    except (URLError, OSError):
        # Do not log the request URL: it contains the Telegram bot token.
        raise RuntimeError("sendVideo: ошибка соединения с Telegram") from None
    if not result.get("ok"):
        raise RuntimeError(f"sendVideo: {result.get('description', 'Неизвестная ошибка')}")
    message_id = result["result"]["message_id"]
    print(f"Опубликовано видео: https://t.me/applemarket26/{message_id}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        raise SystemExit("Использование: video_publisher.py <approved.json> <video.mp4>")
    try:
        publish_approved_video(sys.argv[1], sys.argv[2])
    except (RuntimeError, ValueError, KeyError) as exc:
        raise SystemExit(f"Ошибка: {exc}") from None

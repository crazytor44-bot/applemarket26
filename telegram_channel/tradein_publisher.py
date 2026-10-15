#!/usr/bin/env python3
"""Publish the owner's single approved Trade-in image post at/after Moscow 09:00 on 2026-10-16."""
import hashlib
import json
import os
import secrets
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from zoneinfo import ZoneInfo

from publisher import CHAT, verify

APPROVAL = Path("telegram_channel/tradein_approved/2026-10-16.json")
PHOTO_PATH = Path("telegram_channel/media/tradein-2026-10-16.jpg")
PHOTO_BLOB_SHA = "bdab92a92c625c37a465be914bb1e9dfb6030e55"


def main():
    now = datetime.now(ZoneInfo("Europe/Moscow"))
    if now.strftime("%Y-%m-%d") != "2026-10-16" or now.hour < 9:
        print("Outside the single approved publication window; NOT sending.")
        return
    post = json.loads(APPROVAL.read_text(encoding="utf-8"))
    caption = post.get("text")
    if (not isinstance(caption, str) or not caption.startswith("📱 ТВОЙ СТАРЫЙ iPHONE МОЖЕТ СТАТЬ НОВЫМ! 🔥")
            or len(caption) > 1024 or post.get("pin") is not False or post.get("parse_mode") != "plain"
            or post.get("photo_repository_path") != str(PHOTO_PATH)
            or post.get("photo_git_blob_sha") != PHOTO_BLOB_SHA):
        raise RuntimeError("Approved caption/photo metadata validation failed.")
    photo = PHOTO_PATH.read_bytes()
    if not (20000 < len(photo) < 10000000) or not photo.startswith(b"\xff\xd8"):
        raise RuntimeError("Approved photo is missing or not JPEG.")
    blob = b"blob " + str(len(photo)).encode("ascii") + b"\0" + photo
    if hashlib.sha1(blob).hexdigest() != PHOTO_BLOB_SHA:
        raise RuntimeError("Approved photo hash mismatch; NOT sending.")

    # Fail closed if the exact post is visible in the public channel already.
    try:
        req = Request("https://t.me/s/applemarket26", headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=15) as resp:
            page = resp.read(1000000).decode("utf-8", errors="replace")
        if "ТВОЙ СТАРЫЙ iPHONE МОЖЕТ СТАТЬ НОВЫМ" in page:
            print("This post is already visible in the channel. NOT sending duplicate.")
            return
    except (HTTPError, URLError, OSError):
        # The workflow itself runs only once on the specified date; do not let a blocked
        # public webpage prevent that one approved publication.
        print("Public feed unavailable; proceeding with the one-time approved schedule.")

    verify(post_messages=True)
    token = os.environ.get("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Missing Telegram bot token secret.")
    boundary = "amarket-tradein-" + secrets.token_hex(12)
    body = bytearray()
    for field_name, field_value in (("chat_id", CHAT), ("caption", caption)):
        body.extend((f'--{boundary}\r\nContent-Disposition: form-data; name="{field_name}"\r\n\r\n{field_value}\r\n').encode("utf-8"))
    body.extend((f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="tradein-2026-10-16.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode("utf-8"))
    body.extend(photo)
    body.extend(f'\r\n--{boundary}--\r\n'.encode("utf-8"))
    request = Request(f"https://api.telegram.org/bot{token}/sendPhoto",
                      data=bytes(body), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
    try:
        with urlopen(request, timeout=90) as resp:
            result = json.load(resp)
    except HTTPError as exc:
        try:
            detail = json.load(exc).get("description", "Telegram HTTP error")
        except (ValueError, OSError):
            detail = "Telegram HTTP error"
        raise RuntimeError("sendPhoto: " + detail) from None
    except (URLError, OSError):
        raise RuntimeError("sendPhoto: Telegram connection failed (secret not logged)") from None
    if not result.get("ok"):
        raise RuntimeError("sendPhoto: " + str(result.get("description", "Telegram API error")))
    message_id = result["result"]["message_id"]
    print(f"Published approved photo and caption: https://t.me/applemarket26/{message_id}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError) as exc:
        raise SystemExit("Ошибка: " + str(exc)) from None

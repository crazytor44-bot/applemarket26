#!/usr/bin/env python3
"""Publish owner-approved, time-locked image posts with a claim-before-send receipt."""
import argparse
import base64
from datetime import datetime, timedelta
import hashlib
import html
import json
import os
from pathlib import Path
import re
import secrets
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from publisher import CHAT, verify

REPO = "crazytor44-bot/applemarket26"
QUEUE = Path("telegram_channel/post_queue")
STATE = "telegram_channel/post_receipts"
ZONE = ZoneInfo("Europe/Moscow")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def validate(path):
    require(re.fullmatch(r"\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{1,60}\.json", path.name), "Неверное имя файла")
    post = json.loads(path.read_text(encoding="utf-8"))
    require(post.get("approved") is True and post.get("channel") == CHAT, "Нет утверждения владельца")
    require(post.get("pin") is False and post.get("parse_mode") == "plain", "Запрещено закрепление или HTML")
    kind = post.get("kind", "photo")
    require(kind in {"photo", "text", "poll"}, "Неизвестный формат публикации")
    caption = post.get("text")
    maxlen = 1024 if kind == "photo" else 300 if kind == "poll" else 4096
    require(isinstance(caption, str) and 0 < len(caption) <= maxlen, "Некорректная длина текста")
    timestamp = post.get("publish_at")
    require(isinstance(timestamp, str), "Нет времени")
    due = datetime.fromisoformat(timestamp)
    require(due.tzinfo and due.utcoffset() == timedelta(hours=3), "Время должно содержать +03:00")
    require(due.strftime("%Y-%m-%d") == path.name[:10], "Разные даты в имени и содержимом")
    if kind == "poll":
        opts = post.get("options")
        require(isinstance(opts, list) and 2 <= len(opts) <= 10
                and all(isinstance(o, str) and 0 < len(o) <= 100 for o in opts)
                and len(set(opts)) == len(opts), "Опрос должен иметь от 2 до 10 разных вариантов")
    if kind in {"text", "poll"}:
        require(not post.get("photo_repository_path") and not post.get("photo_git_blob_sha"),
                "Текст и опрос не должны содержать вложений")
        return post, due.astimezone(ZONE), b"", kind
    picture = post.get("photo_repository_path")
    require(isinstance(picture, str) and re.fullmatch(r"telegram_channel/media/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png)", picture), "Нет подтверждённого изображения")
    raw = Path(picture).read_bytes()
    require(1024 <= len(raw) <= 10_000_000, "Некорректный размер изображения")
    mime = "image/png" if picture.endswith(".png") else "image/jpeg"
    require(raw.startswith(b"\x89PNG\r\n\x1a\n") if mime == "image/png" else raw.startswith(bytes([255,216])), "Некорректный файл изображения")
    blob_hash = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    require(post.get("photo_git_blob_sha") == blob_hash, "Изображение отличается от утверждённого")
    return post, due.astimezone(ZONE), raw, mime


def github(method, path, payload=None):
    token = os.getenv("GITHUB_TOKEN", "")
    require(bool(token) and os.getenv("GITHUB_REPOSITORY") == REPO and os.getenv("GITHUB_REF") == "refs/heads/main", "Нет доступа к GitHub main: отправка отменена")
    address = "https://api.github.com/repos/" + REPO + "/contents/" + path
    req = Request(address, data=json.dumps(payload).encode() if payload else None, method=method, headers={
        "Authorization":"Bearer " + token,
        "Accept":"application/vnd.github+json",
        "Content-Type":"application/json",
        "User-Agent":"AMarket-approved-post-queue"})
    try:
        with urlopen(req, timeout=25) as res:
            return json.load(res)
    except HTTPError as exc:
        if exc.code in (409, 422):
            raise FileExistsError("GitHub receipt conflict") from None
        raise RuntimeError("GitHub HTTP " + str(exc.code) + "; not sending") from None
    except (URLError, OSError):
        raise RuntimeError("GitHub unavailable; not sending") from None


def claim(path, post):
    state = f"{STATE}/{path.name}"
    receipt = {"status":"claimed_before_send", "post":str(path),
               "caption_sha256":hashlib.sha256(post["text"].encode()).hexdigest(),
               "run":os.getenv("GITHUB_RUN_ID"), "claimed_at":datetime.now(ZONE).isoformat()}
    data = {"branch":"main", "message":"Claim approved post "+path.name,
            "content":base64.b64encode((json.dumps(receipt, ensure_ascii=False)+"\n").encode()).decode()}
    try:
        result = github("PUT", state, data)
        return result["content"]["sha"]
    except FileExistsError:
        # Only a previously created receipt can prove exclusivity.
        try:
            github("GET", state)
        except Exception:
            raise RuntimeError("Receipt collision without evidence of prior claim; not sending") from None
        print("SKIP: post already claimed:", path.name)
        return None


def update_receipt(path, sha, message_id):
    info = {"status":"published", "post":str(path), "message_id":message_id,
            "link":f"https://t.me/applemarket26/{message_id}", "published_at":datetime.now(ZONE).isoformat()}
    req = {"branch":"main", "message":"Telegram post published "+str(message_id), "sha":sha,
           "content":base64.b64encode((json.dumps(info, ensure_ascii=False)+"\n").encode()).decode()}
    try:
        github("PUT", f"{STATE}/{path.name}", req)
    except Exception as exc:
        print("WARNING: posted successfully, but receipt remains claimed:", exc, file=sys.stderr)


def duplicate_on_public_feed(caption):
    try:
        req = Request("https://t.me/s/applemarket26", headers={"User-Agent":"Mozilla/5.0"})
        with urlopen(req, timeout=10) as res:
            body = res.read(1_500_000).decode("utf-8",errors="replace")
        normalized = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>"," ",body)))
        headline = re.sub(r"\s+", " ",caption[:90]).strip()
        return headline in normalized
    except (OSError, ValueError):
        print("Public channel check unavailable; exclusive claim still guards duplicates.")
        return False


def send(post, photo, mime):
    if mime in ("text", "poll"):
        # No image needed for useful tips and interactive native Telegram polls.
        from publisher import telegram
        if mime == "text":
            result = telegram("sendMessage", {"chat_id": CHAT, "text": post["text"],
                                             "link_preview_options": {"is_disabled": True}})
        else:
            result = telegram("sendPoll", {"chat_id": CHAT, "question": post["text"],
                                          "options": [{"text": s} for s in post["options"]],
                                          "is_anonymous": True,
                                          "allows_multiple_answers": False})
        return int(result["message_id"])
    token = os.getenv("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    require(bool(token), "Отсутствует секрет бота")
    boundary = "amarket-post-" + secrets.token_hex(12)
    parts = bytearray()
    for name, value in [("chat_id",CHAT), ("caption",post["text"])]:
        parts.extend((f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n').encode("utf-8"))
    suffix = ".png" if mime == "image/png" else ".jpg"
    parts.extend((f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="amarket-approved{suffix}"\r\nContent-Type: {mime}\r\n\r\n').encode())
    parts.extend(photo)
    parts.extend(f"\r\n--{boundary}--\r\n".encode())
    request = Request("https://api.telegram.org/bot"+token+"/sendPhoto", data=bytes(parts),
                      method="POST", headers={"Content-Type":f"multipart/form-data; boundary={boundary}"})
    try:
        with urlopen(request, timeout=90) as response:
            result = json.load(response)
    except HTTPError as exc:
        try:
            desc = json.load(exc).get("description","Telegram error")
        except (OSError, ValueError):
            desc = "Telegram error"
        raise RuntimeError("sendPhoto: "+desc) from None
    except (URLError, OSError):
        raise RuntimeError("sendPhoto: unclear response; inspect channel, do not retry automatically") from None
    require(result.get("ok"), "sendPhoto: " + str(result.get("description","Telegram API error")))
    return int(result["result"]["message_id"])


def main(check_only):
    now = datetime.now(ZONE)
    scheduled = [ (path, *validate(path)) for path in sorted(QUEUE.glob("*.json")) ]
    if check_only:
        print(f"Validated {len(scheduled)} owner-approved queued post(s). No Telegram messages sent.")
        return
    due = [(path,post,when,data,mime) for path,post,when,data,mime in scheduled if when <= now and now-when < timedelta(hours=24)]
    if not due:
        print("No due approved posts; nothing sent.")
        return
    verify(post_messages=True)
    for path,post,when,photo,mime in due:
        if duplicate_on_public_feed(post["text"]):
            print("SKIP: matching text already visible in public channel:",path.name)
            continue
        sha = claim(path,post)
        if sha is None:
            continue
        # No automatic retry after claiming: uncertain Telegram response might be a success.
        message_id = send(post,photo,mime)
        url = f"https://t.me/applemarket26/{message_id}"
        print("PUBLISHED:",url,flush=True)
        update_receipt(path,sha,message_id)
        summary = os.getenv("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary,"a",encoding="utf-8") as output:
                output.write("✅ "+url+"\n")


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    options=parser.add_mutually_exclusive_group(required=True)
    options.add_argument("--check",action="store_true")
    options.add_argument("--publish",action="store_true")
    args=parser.parse_args()
    try:
        main(args.check)
    except (RuntimeError, OSError, ValueError, KeyError) as exc:
        raise SystemExit("Ошибка: "+str(exc)) from None

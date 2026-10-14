#!/usr/bin/env python3
"""Aggregate *public* Telegram channel metrics without tracking people.

Telegram does not disclose viewer or reaction identities for channel posts.
This script uses the public preview of @applemarket26 and an admin bot
to check subscriber count. It never calls getUpdates, avoiding interference
with other bot integrations, and never reads private chats.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

CHANNEL = "applemarket26"
PAGE_URL = f"https://t.me/s/{CHANNEL}"
OUT = Path("telegram_channel/analytics")
OUT.mkdir(parents=True, exist_ok=True)


def fetch_public_html() -> str:
    request = Request(
        PAGE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; AMarketPublicStats/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read(4_000_000).decode("utf-8", "replace")


def count_number(label: str) -> int | None:
    """Telegram abbreviations like 1.2K or 1,2K."""
    clean = label.replace("\u00a0", " ").replace("\u202f", " ").strip()
    match = re.search(r"([\d.,]+)\s*([KkMm]?)\b", clean)
    if not match:
        return None
    number, suffix = match.groups()
    if suffix:
        try:
            return round(float(number.replace(",", ".")) * (1_000 if suffix.lower() == "k" else 1_000_000))
        except ValueError:
            return None
    try:
        return int(number.replace(",", "").replace(".", ""))
    except ValueError:
        return None


def get_subscribers() -> int | None:
    token = os.getenv("AMARKET_TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        return None
    # Do not log the URL: it contains the bot token.
    req = Request(
        f"https://api.telegram.org/bot{token}/getChatMemberCount",
        data=json.dumps({"chat_id": f"@{CHANNEL}"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=20) as response:
            data = json.load(response)
        if data.get("ok") and isinstance(data.get("result"), int):
            return data["result"]
    except (HTTPError, URLError, ValueError):
        pass
    return None


def parse_public_posts(page: str) -> list[dict]:
    soup = BeautifulSoup(page, "html.parser")
    posts = []
    for card in soup.select('[data-post]'):
        ident = card.get("data-post", "")
        if not re.fullmatch(rf"{CHANNEL}/\d+", ident):
            continue
        post_id = int(ident.split("/")[-1])
        # Only count what Telegram actually displays; null means unknown.
        views_el = card.select_one(".tgme_widget_message_views")
        views = count_number(views_el.get_text(" ", strip=True)) if views_el else None
        # Emoji identities are never exposed; only counters.
        reactions = {}
        for badge in card.select(".tgme_reaction, .tgme_widget_message_reaction"):
            # Public Telegram preview currently uses .tgme_reaction.
            # Examples rendered as emoji + count, e.g. '🤔1' or '👍 2'.
            raw = badge.get_text(" ", strip=True)
            match = re.search(r"([\\d.,]+\\s*[KkMm]?)\\s*$", raw)
            if not match:
                continue
            amount = count_number(match.group(1))
            if amount is None:
                continue
            emoji = raw[:match.start()].strip() or "other"
            reactions[emoji] = reactions.get(emoji, 0) + amount
        # Absence of counters in public HTML does NOT prove zero reactions.
        reaction_total = sum(reactions.values()) if reactions else None
        replies = card.select_one(".tgme_widget_message_replies")
        comment_count = count_number(replies.get_text(" ", strip=True)) if replies else None
        posts.append({
            "id": post_id,
            "url": f"https://t.me/{CHANNEL}/{post_id}",
            "views": views,
            "reactions_total": reaction_total,
            "reactions_by_emoji": reactions,
            "comments": comment_count,
        })
    # Public preview typically contains recent messages (not the full history).
    return sorted({p["id"]: p for p in posts}.values(), key=lambda x: x["id"], reverse=True)


def pretty(value: int | None) -> str:
    return "—" if value is None else str(value)


def main() -> None:
    html = fetch_public_html()
    posts = parse_public_posts(html)
    if not posts:
        raise SystemExit("Telegram не вернул публичных постов — отчёт не создан (чтобы не показывать ложные нули).")
    # Diagnostics contain ONLY public layout tags/classes and no messages or users.
    latest = next((node for node in BeautifulSoup(html, "html.parser").select('[data-post]') if node.get("data-post") == f"{CHANNEL}/60"), None)
    if latest is not None:
        classes = sorted({part for node in latest.find_all(True) for part in (node.get("class") or []) if "reaction" in part or "views" in part})
        print("Проверка публичной разметки реакций #60:", ", ".join(classes) if classes else "отсутствует")
        print("Счётчик реакций на публичной странице:", len(latest.select(".tgme_widget_message_reaction")))
    now = datetime.now(timezone.utc)
    snapshot = {
        "collected_at_utc": now.isoformat(timespec="seconds"),
        "channel": f"@{CHANNEL}",
        "subscriber_count": get_subscribers(),
        "post_count_in_public_preview": len(posts),
        "note": (
            "Только публичная статистика последних доступных постов. "
            "Telegram не раскрывает список читателей и авторов реакций; "
            "прочерки означают отсутствие данных, а не ноль."
        ),
        "posts": posts,
    }
    result_path = OUT / "latest.json"
    result_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rows = [
        "# А Маркет — статистика Telegram",
        "",
        f"Срез: {now:%Y-%m-%d %H:%M} UTC / Ставрополь +3 часа",
        f"Подписчиков: **{pretty(snapshot['subscriber_count'])}**",
        f"Публичных сообщений в выборке: **{len(posts)}**",
        "",
        "| Пост | Просмотры | Реакции | Комментарии |",
        "| --- | ---: | ---: | ---: |",
    ]
    for p in posts[:20]:
        rows.append(
            f"| [№{p['id']}]({p['url']}) | {pretty(p['views'])} | "
            f"{pretty(p['reactions_total'])} | {pretty(p['comments'])} |"
        )
    rows += [
        "",
        "ℹ️ Telegram скрывает личности смотревших и поставивших реакции.",
        "Счётчики могут обновляться с задержкой. Прочерк — недоступные сведения.",
        "Опрос реакций в канале не равнозначен опросу всех подписчиков.",
    ]
    report = "\n".join(rows) + "\n"
    (OUT / "latest.md").write_text(report, encoding="utf-8")
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(report)
    print(f"Публичная статистика готова: {len(posts)} сообщений, подписчиков: {pretty(snapshot['subscriber_count'])}")
    for p in posts[:5]:
        print(f"#{p['id']}: {pretty(p['views'])} просмотров, {pretty(p['reactions_total'])} реакций")


if __name__ == "__main__":
    main()

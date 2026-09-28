#!/usr/bin/env python3
"""Read the latest iCenter Telegram price batch and update the static catalog."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import html
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "catalog" / "index.html"
YML_PATH = ROOT / "yml.xml"
PHONE = "79383119888"
MARKUP = 2_000
MOSCOW = ZoneInfo("Europe/Moscow")
CHANNEL_DEFAULT = "iCenter Stavropol"

CATALOG_RE = re.compile(
    r'(<script\s+id="catalog-data"\s+type="application/json">)(.*?)(</script>)', re.DOTALL
)
PRICE_RE = re.compile(
    r"^(.*?)\s+(?:[-–—:]\s*)?(\d{1,3}(?:[.\s\u00a0\u202f]\d{3})+|\d{4,7})\s*(?:₽|руб\.?|р\.)?\s*$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class PriceEntry:
    name: str
    supplier_price: int
    key: str


def normal_key(value: str) -> str:
    s = unicodedata.normalize("NFKC", value).lower()
    s = re.sub(r"\([^)]*(?:rustore|гаранти)[^)]*\)", " ", s)
    for flag, code in {"🇯🇵": " jp ", "🇮🇳": " in ", "🇪🇺": " eu ", "🇨🇳": " cn ", "🇺🇸": " us ", "🇦🇪": " ae ", "🇭🇰": " hk "}.items():
        s = s.replace(flag, code)
    s = re.sub(r"apple\s*watch", " ", s)
    s = re.sub(r"\b(?:apple|iphone)\b", " ", s)
    s = re.sub(r"\bse\s*([23])\b", r"se\1", s)
    s = re.sub(r"\bs\s*11\b", "series 11", s)
    s = re.sub(r"\b(\d+)\s*(?:tb|тб)\b", lambda m: f" {int(m.group(1)) * 1024}gb ", s)
    s = re.sub(r"\b(\d+)\s*(?:gb|гб)\b", r" \1gb ", s)
    s = re.sub(r"\b(128|256|512|1024|2048)\b(?!\s*gb)", r"\1gb", s)
    s = re.sub(r"\b1\s*sim\b", "1sim", s)
    s = re.sub(r"\be\s*sim\b", "esim", s)
    s = re.sub(r"usb[\s‑–—-]*c", "usbc", s)
    s = re.sub(r"[^\w/]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()


def is_iphone_18(name: str) -> bool:
    return bool(re.search(r"^\s*(?:iphone\s+)?18(?:\s|$)", name, re.IGNORECASE))


def parse_price_text(text: str) -> list[PriceEntry]:
    entries: dict[str, PriceEntry] = {}
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line or line.startswith(("▪", "▫", "◾")):
            continue
        if re.match(r"^(?:iCenter\s+Stavropol\s*,?\s*\[|От\s+\d+\s*шт)", line, re.I):
            continue
        clean = re.sub(r"\*.*$", "", line)
        clean = re.sub(r"[🚛🚚🔥❗❕‼️]", "", clean).strip()
        match = PRICE_RE.match(clean)
        if not match:
            continue
        name = match.group(1).strip(" -–—:")
        if not name or is_iphone_18(name):
            continue
        amount = int(re.sub(r"[.\s\u00a0\u202f]", "", match.group(2)))
        if not 0 < amount <= 2_000_000:
            continue
        key = normal_key(name)
        if key:
            entries[key] = PriceEntry(name=name, supplier_price=amount, key=key)
    return list(entries.values())


def category_for(name: str) -> str:
    s = name.lower()
    if re.search(r"\b(?:iphone\s*)?(?:1[1-79]|se)\b", s): return "iphone"
    if "samsung" in s or "galaxy" in s: return "samsung"
    if any(word in s for word in ("macbook", "imac", "mac mini", "mac studio")): return "mac"
    if "ipad" in s: return "ipad"
    if "airpods" in s: return "airpods"
    if "watch" in s: return "watch"
    if any(word in s for word in ("playstation", "ps5", "dualsense", "ps portal", "sony pulse")): return "gaming"
    return "accessories"


def memory_for(name: str) -> int | None:
    values = [int(x) for x in re.findall(r"\b(\d+)\s*(?:GB|ГБ)\b", name, re.I)]
    return max(values) if values else None


def model_for(name: str, category: str) -> str:
    patterns = {
        "iphone": r"(?:iPhone\s+)?(1[1-79](?:\s+(?:Pro\s+Max|Pro|Plus|e|Air))?)",
        "samsung": r"(?:Samsung\s+)?(Galaxy\s+(?:S|A|Z\s+(?:Fold|Flip))?\s*\d+(?:\s+(?:Ultra|Plus|FE))?)",
        "mac": r"((?:MacBook\s+(?:Air|Pro|Neo)|iMac|Mac\s+(?:mini|Studio))(?:\s+\d{2})?(?:\s+M\d)?)",
        "ipad": r"((?:iPad)(?:\s+(?:Air|Pro|mini))?(?:\s+\d{1,2})?(?:\s+M\d)?)",
        "airpods": r"(AirPods(?:\s+(?:Pro|Max))?\s*\d*)",
        "watch": r"((?:Apple\s+)?Watch(?:\s+(?:Series|Ultra|SE))?\s*\d*)",
        "gaming": r"((?:DualSense\s+PS5|PlayStation\s*5|PS5|PS\s+Portal|Sony\s+Pulse))",
    }
    match = re.search(patterns.get(category, r"$^"), name, re.I)
    if match:
        model = match.group(1).strip()
        if category == "iphone" and not model.lower().startswith("iphone"):
            model = "iPhone " + model
        return re.sub(r"\s+", " ", model)
    return name


def whatsapp_url(name: str, price: int, available: bool) -> str:
    formatted = f"{price:,}".replace(",", " ")
    ending = "Есть в наличии?" if available else "Когда ожидается поступление?"
    text = f"Здравствуйте! Интересует {name} за {formatted} ₽. {ending}"
    return f"https://wa.me/{PHONE}?" + urllib.parse.urlencode({"text": text})


def new_product(entry: PriceEntry) -> dict:
    category = category_for(entry.name)
    product_id = "icenter-" + hashlib.sha1(entry.key.encode("utf-8")).hexdigest()[:14]
    price = entry.supplier_price + MARKUP
    return {"id": product_id, "name": entry.name, "category": category, "model": model_for(entry.name, category),
            "memory": memory_for(entry.name), "price": price, "preorder": False, "notes": "", "transit": False,
            "available": True, "source": "icenter", "meta": "В наличии · Цена обновляется автоматически",
            "url": whatsapp_url(entry.name, price, True)}


def merge_products(products: list[dict], entries: list[PriceEntry]) -> tuple[list[dict], dict[str, int]]:
    by_key: dict[str, list[int]] = {}
    for index, product in enumerate(products):
        if not is_iphone_18(product.get("name", "")):
            by_key.setdefault(normal_key(product.get("name", "")), []).append(index)
    seen: set[int] = set()
    stats = {"updated": 0, "added": 0, "unavailable": 0,
             "protected18": sum(is_iphone_18(p.get("name", "")) for p in products)}
    for entry in entries:
        matches = by_key.get(entry.key, [])
        if len(matches) == 1:
            index = matches[0]
            product = products[index]
            price = entry.supplier_price + MARKUP
            product.update(price=price, available=True, source="icenter",
                           meta="В наличии · Цена обновляется автоматически",
                           url=whatsapp_url(product["name"], price, True))
            seen.add(index); stats["updated"] += 1
        elif not matches:
            products.append(new_product(entry))
            index = len(products) - 1
            by_key.setdefault(entry.key, []).append(index)
            seen.add(index); stats["added"] += 1
    for index, product in enumerate(products):
        if is_iphone_18(product.get("name", "")) or index in seen:
            continue
        product.update(available=False, meta="Нет в наличии",
                       url=whatsapp_url(product["name"], int(product["price"]), False))
        stats["unavailable"] += 1
    return products, stats


def load_products(path: Path = CATALOG_PATH) -> tuple[str, list[dict]]:
    source = path.read_text(encoding="utf-8")
    match = CATALOG_RE.search(source)
    if not match: raise RuntimeError("Не найден catalog-data")
    products = json.loads(html.unescape(match.group(2)))
    if not isinstance(products, list) or not products: raise RuntimeError("Каталог пуст")
    return source, products


def safe_json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def save_products(source: str, products: list[dict], path: Path = CATALOG_PATH) -> None:
    updated, count = CATALOG_RE.subn(lambda m: m.group(1) + safe_json(products) + m.group(3), source, count=1)
    if count != 1: raise RuntimeError("Не удалось обновить catalog-data")
    path.write_text(updated, encoding="utf-8")


def update_yml(products: list[dict], path: Path = YML_PATH) -> None:
    categories = {"iphone": ("1", "iPhone"), "samsung": ("2", "Samsung"), "mac": ("3", "Mac"),
                  "ipad": ("4", "iPad"), "watch": ("5", "Apple Watch"), "airpods": ("6", "AirPods"),
                  "accessories": ("7", "Аксессуары"), "gaming": ("8", "Игры и PlayStation")}
    root = ET.Element("yml_catalog", {"date": datetime.now(MOSCOW).strftime("%Y-%m-%d %H:%M")})
    shop = ET.SubElement(root, "shop")
    for tag, value in (("name", "А Маркет"), ("company", "А Маркет"), ("url", "https://applemarket26.ru")):
        ET.SubElement(shop, tag).text = value
    currencies = ET.SubElement(shop, "currencies"); ET.SubElement(currencies, "currency", {"id": "RUR", "rate": "1"})
    category_node = ET.SubElement(shop, "categories"); used = {p.get("category", "accessories") for p in products}
    for key, (category_id, label) in categories.items():
        if key in used: ET.SubElement(category_node, "category", {"id": category_id}).text = label
    offers = ET.SubElement(shop, "offers")
    for index, product in enumerate(products, 1000):
        category = product.get("category", "accessories"); category_id = categories.get(category, categories["accessories"])[0]
        offer = ET.SubElement(offers, "offer", {"id": str(index), "available": str(product.get("available", True)).lower()})
        ET.SubElement(offer, "url").text = product.get("page") or f"https://applemarket26.ru/catalog/?q={urllib.parse.quote(product['name'])}"
        ET.SubElement(offer, "price").text = str(product["price"]); ET.SubElement(offer, "currencyId").text = "RUR"
        ET.SubElement(offer, "categoryId").text = category_id; ET.SubElement(offer, "name").text = product["name"]
        ET.SubElement(offer, "vendor").text = "Samsung" if category == "samsung" else ("Sony" if category == "gaming" else "Apple")
        ET.SubElement(offer, "description").text = product.get("meta", "Наличие уточняйте")
    path.write_text('<?xml version="1.0" encoding="UTF-8"?>' + ET.tostring(root, encoding="unicode"), encoding="utf-8")


async def telegram_batch() -> str:
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError as exc: raise RuntimeError("Установите telethon") from exc
    api_id = int(os.environ["TELEGRAM_API_ID"]); api_hash = os.environ["TELEGRAM_API_HASH"]
    session = os.environ["TELEGRAM_SESSION"]; channel_name = os.getenv("TELEGRAM_CHANNEL", CHANNEL_DEFAULT).strip()
    async with TelegramClient(StringSession(session), api_id, api_hash) as client:
        entity = None
        async for dialog in client.iter_dialogs():
            if dialog.name.strip().casefold() == channel_name.casefold(): entity = dialog.entity; break
        if entity is None: raise RuntimeError(f"Канал {channel_name!r} не найден в Telegram-аккаунте")
        messages = []
        async for message in client.iter_messages(entity, limit=250):
            if message.message:
                activity = message.edit_date or message.date
                messages.append((activity.astimezone(MOSCOW), message.id, message.message))
        if not messages: raise RuntimeError("В канале не найдены текстовые сообщения")
        newest_day = max(item[0].date() for item in messages)
        batch = sorted((item for item in messages if item[0].date() == newest_day), key=lambda item: (item[0], item[1]))
        return "\n".join(item[2] for item in batch)


def run(text: str, minimum: int) -> dict[str, int]:
    entries = parse_price_text(text)
    source, products = load_products()
    managed = sum(not is_iphone_18(product.get("name", "")) for product in products)
    safe_minimum = max(minimum, min(100, (managed * 45 + 99) // 100))
    if len(entries) < safe_minimum:
        raise RuntimeError(f"Защитная остановка: распознано только {len(entries)} позиций, безопасный минимум {safe_minimum}. Каталог не изменён.")
    merged, stats = merge_products(products, entries)
    save_products(source, merged); update_yml(merged)
    stats.update(parsed=len(entries), total=len(merged)); return stats


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--input", type=Path)
    parser.add_argument("--minimum", type=int, default=int(os.getenv("MIN_PRICE_ITEMS", "20"))); args = parser.parse_args()
    try:
        text = args.input.read_text(encoding="utf-8") if args.input else asyncio.run(telegram_batch())
        stats = run(text, args.minimum)
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr); return 1
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True)); return 0


if __name__ == "__main__": raise SystemExit(main())

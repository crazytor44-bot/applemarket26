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
HOME_PATH = ROOT / "index.html"
YML_PATH = ROOT / "yml.xml"
PHONE = "79383119888"
LOW_PRICE_LIMIT = 10_000
MOSCOW = ZoneInfo("Europe/Moscow")
CHANNEL_DEFAULT = "iCenter Stavropol"

CATALOG_RE = re.compile(
    r'(<script\s+id="catalog-data"\s+type="application/json">)(.*?)(</script>)', re.DOTALL
)
DETAIL_DATA_RE = re.compile(
    r'(<script\s+id="product-data"\s+type="application/json">)(.*?)(</script>)', re.DOTALL
)
DETAIL_PRICE_RE = re.compile(
    r'(<strong\s+id="price"[^>]*>)(.*?)(</strong>)', re.DOTALL
)
CATALOG_CARD_RE = re.compile(
    r'(<article\b(?=[^>]*\bclass="[^"]*\bcatalog-item\b)(?=[^>]*\bdata-id="([^"]+)")[^>]*>)(.*?)(</article>)',
    re.DOTALL,
)
CARD_PRICE_RE = re.compile(
    r'(<div\s+class="catalog-item-bottom"[^>]*>\s*<strong>)(.*?)(</strong>)', re.DOTALL
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
    transit: bool = False


def normal_key(value: str) -> str:
    s = unicodedata.normalize("NFKC", value).lower()
    s = re.sub(r"\([^)]*(?:rustore|гаранти)[^)]*\)", " ", s)
    for flag, code in {"🇯🇵": " jp ", "🇮🇳": " in ", "🇪🇺": " eu ", "🇨🇳": " cn ", "🇺🇸": " us ", "🇦🇪": " ae ", "🇭🇰": " hk "}.items():
        s = s.replace(flag, code)
    s = re.sub(r"apple\s*watch", " ", s)
    s = re.sub(r"\b(?:apple|iphone|ipad|samsung|galaxy|macbook)\b", " ", s)
    s = re.sub(r"\bairpods\s+max\s+2\s+2026\b", "airpods max 2026", s)
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


def iphone_18_display_fields(name: str, model: str) -> dict:
    if not is_iphone_18(name):
        return {}
    fields: dict[str, str] = {}
    color = re.search(r"\b(Black|Burgundy|Glacier|Silver)\b", name, re.I)
    region = re.search(r"(🇯🇵|🇪🇺|🇭🇰|🇺🇸|🇦🇪)", name)
    if color:
        fields["color"] = color.group(1).title()
    if region:
        fields["region"] = region.group(1)
    if re.search(r"\b18\s+Pro\s+Max\b", model, re.I):
        fields["page"] = "/iphone-18-pro-max/"
    elif re.search(r"\b18\s+Pro\b", model, re.I):
        fields["page"] = "/iphone-18-pro/"
    return fields


def iphone_display_fields(name: str) -> dict:
    fields: dict[str, str] = {}
    color = re.search(r"\\b(Black|White|Natural|Desert|Silver|Blue|Pink|Teal|Ultramarine|Green|Yellow|Purple|Gold|Graphite|Sierra Blue|Alpine Green|Deep Purple|Space Black)\\b", name, re.I)
    region = re.search(r"(🇯🇵|🇮🇳|🇪🇺|🇨🇳|🇺🇸|🇦🇪|🇭🇰|🇰🇼)", name)
    if color:
        fields["color"] = color.group(1).title()
    if region:
        fields["region"] = region.group(1)
    return fields

def parse_price_text(text: str) -> list[PriceEntry]:
    entries: dict[str, PriceEntry] = {}
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line or line.startswith(("▪", "▫", "◾")):
            continue
        if re.match(r"^(?:iCenter\s+Stavropol\s*,?\s*\[|От\s+\d+\s*шт)", line, re.I):
            continue
        transit = "✈️" in line or "✈" in line
        clean = re.sub(r"\*.*$", "", line)
        clean = re.sub(r"[🚛🚚🔥❗❕‼️✈]", "", clean).strip()
        match = PRICE_RE.match(clean)
        if not match:
            continue
        name = match.group(1).strip(" -–—:")
        if not name:
            continue
        amount = int(re.sub(r"[.\s\u00a0\u202f]", "", match.group(2)))
        if not 0 < amount <= 2_000_000:
            continue
        key = normal_key(name)
        if key:
            entries[key] = PriceEntry(name=name, supplier_price=amount, key=key, transit=transit)
    return list(entries.values())


def category_for(name: str) -> str:
    s = unicodedata.normalize("NFKC", name).lower().strip()
    # Supplier often abbreviates Apple Watch as S11 / SE 3 / Ultra 3.
    # Recognize those before Samsung's S-series shorthand.
    if ("samsung" not in s and "galaxy" not in s and
            re.match(r"^(?:s(?:eries)?\s*11|se\s*[23]|ultra\s*[2-4])(?:\s|$)", s)):
        return "watch"
    if ("samsung" in s or "galaxy" in s or
            re.match(r"^(?:a\d{2}|s\d{2}(?:\s|$)|z\s+(?:flip|fold)|buds\s*\d)", s)):
        return "samsung"
    if (any(word in s for word in ("macbook", "imac", "mac mini", "mac studio")) or
            re.match(r"^(?:neo\s+13|(?:air\s+(?:13|15)|pro\s+14)\s+m\d)\s+\d+/", s)):
        return "mac"
    if ("ipad" in s or re.match(r"^(?:11\s+a\d+|(?:air|pro)\s+(?:11|13)\s+m\d).*(?:wi[ -]?fi|lte)", s)):
        return "ipad"
    if "airpods" in s: return "airpods"
    if ("watch" in s or re.match(r"^(?:series\s*\d+|se\s*[23]\s+\d{2}\s*mm|ultra\s*[2-4]\s+49\s*mm)", s)):
        return "watch"
    if any(word in s for word in ("playstation", "ps5", "dualsense", "ps portal", "sony pulse")): return "gaming"
    if re.match(r"^(?:note\s+\d+|poco\s+|mi\s+\d+)", s): return "xiaomi"
    if s.startswith("honor "): return "honor"
    if re.match(r"^(?:ht01|hs0[89])\b", s) or "dyson" in s: return "beauty"
    if any(word in s for word in ("g7x", "instax", "osmo", "mic mini")): return "cameras"
    if re.match(r"^fitbit air\b", s): return "accessories"
    if re.match(r"^(?:starfire|rw\d+|ai glasses)", s): return "glasses"
    if any(word in s for word in ("labubu", "zimomo")) or s == "life": return "collectibles"
    if re.match(r"^air\s+\d+gb\b", s): return "iphone"
    if re.match(r"^(?:iphone\s+)?(?:1[1-9](?:e)?)(?:\s|$)", s): return "iphone"
    return "accessories"


def markup_for(supplier_price: int) -> int:
    return 1_000 if supplier_price < LOW_PRICE_LIMIT else 2_000


def memory_for(name: str) -> int | None:
    # Store memory in GB internally; 1TB therefore becomes 1024 GB.
    tb_values = [int(x) * 1024 for x in re.findall(r"\b(\d+)\s*(?:TB|ТБ)\b", name, re.I)]
    gb_values = [int(x) for x in re.findall(r"\b(\d+)\s*(?:GB|ГБ)\b", name, re.I)]
    values = tb_values + gb_values
    return max(values) if values else None


def model_for(name: str, category: str) -> str:
    patterns = {
        "iphone": r"(?:iPhone\s+)?(1[1-9](?:e|\s+(?:Pro\s+Max|Pro|Plus|Air))?|Air)",
        "samsung": r"(?:Samsung\s+)?(?:Galaxy\s+)?((?:S|A)\d+(?:\s+(?:Ultra|Plus|FE))?|Z\s+(?:Fold|Flip)\s*\d+|Buds\s*\d+(?:\s+Pro)?|Watch\s+Ultra)",
        "mac": r"((?:(?:MacBook\s+)?(?:Air|Pro|Neo)|iMac|Mac\s+(?:mini|Studio))(?:\s+\d{2})?(?:\s+M\d)?)",
        "ipad": r"((?:iPad\s+)?(?:(?:Air|Pro)\s+(?:11|13)\s+M\d|11\s+A\d+|iPad(?:\s+(?:Air|Pro|mini))?(?:\s+\d{1,2})?(?:\s+M\d)?))",
        "airpods": r"(AirPods(?:\s+(?:Pro|Max))?\s*\d*)",
        "watch": r"((?:(?:Apple\s+)?Watch\s+)?(?:Series\s*\d+|Ultra\s*\d+|SE\s*\d+))",
        "gaming": r"((?:Charging\s+Station\s+DualSense|DualSense(?:\s+PS5)?|PS5\s+Disc\s+Drive|PlayStation\s*5|PS\s+Portal|Sony\s+Pulse))",
        "xiaomi": r"((?:Redmi\s+)?Note\s+\d+(?:\s+Pro(?:\s+Max)?)?(?:\s+5G)?|Poco\s+[A-Z]\d+(?:\s+(?:Pro|Ultra))?|Mi\s+\d+[A-Z]?(?:\s+(?:Pro|Ultra))?)",
        "honor": r"(Honor\s+\d+(?:\s+(?:Lite|Pro))?)",
        "beauty": r"((?:Dyson\s+)?(?:HT01|HS08|HS09))",
        "cameras": r"((?:Mark\s+3\s+G7X|Mic\s+Mini\s+2|Osmo\s+(?:Mobile\s+8|Nano|Pocket\s+4P)|Instax\s+Mini\s+13))",
        "accessories": r"(Fitbit\s+Air)",
        "glasses": r"((?:Starfire(?:\s+Kylie\s+Jenner)?|RW\d+|AI\s+Glasses))",
        "collectibles": r"((?:LABUBU\s+)?(?:Zimomo|Life))",
    }
    match = re.search(patterns.get(category, r"$^"), name, re.I)
    if match:
        model = match.group(1).strip()
        if category == "iphone" and not model.lower().startswith("iphone"):
            model = "iPhone " + model
        elif category == "samsung" and not model.lower().startswith("samsung"):
            model = "Samsung Galaxy " + model
        elif category == "ipad" and not model.lower().startswith("ipad"):
            model = "iPad " + model
        elif category == "watch" and not model.lower().startswith("apple watch"):
            model = "Apple Watch " + model
        elif category == "mac" and not re.match(r"^(?:macbook|imac|mac\s)", model, re.I):
            model = "MacBook " + model
        elif category == "beauty" and not model.lower().startswith("dyson"):
            model = "Dyson " + model
        elif category == "cameras" and re.match(r"^(?:mic|osmo)", model, re.I):
            model = "DJI " + model
        elif category == "cameras" and model.lower().startswith("instax"):
            model = "Fujifilm " + model
        elif category == "cameras" and model.lower().startswith("mark"):
            model = "Canon PowerShot G7 X Mark III"
        return re.sub(r"\s+", " ", model)
    return name


def group_key_for(name: str, category: str, model: str) -> str:
    base = normal_key(model or name)
    base = re.sub(r"\b(?:128|256|512|1024|2048)gb\b", " ", base)
    base = re.sub(r"[^a-z0-9а-яё]+", "-", base, flags=re.I).strip("-")
    return f"{category}-{base}" if base else f"{category}-other"


def whatsapp_url(name: str, price: int, available: bool) -> str:
    formatted = f"{price:,}".replace(",", " ")
    ending = "Есть в наличии?" if available else "Когда ожидается поступление?"
    text = f"Здравствуйте! Интересует {name} за {formatted} ₽. {ending}"
    return f"https://wa.me/{PHONE}?" + urllib.parse.urlencode({"text": text})


def new_product(entry: PriceEntry) -> dict:
    category = category_for(entry.name)
    model = model_for(entry.name, category)
    product_id = "icenter-" + hashlib.sha1(entry.key.encode("utf-8")).hexdigest()[:14]
    price = entry.supplier_price + markup_for(entry.supplier_price)
    product = {"id": product_id, "name": entry.name, "category": category, "model": model,
               "memory": memory_for(entry.name), "price": price, "preorder": False, "notes": "", "transit": entry.transit,
               "available": True, "source": "icenter", "meta": ("В пути" if entry.transit else "В наличии · Цена обновляется автоматически"),
               "groupKey": group_key_for(entry.name, category, model), "url": whatsapp_url(entry.name, price, True)}
    # New supplier iPhone variants must point at their model detail page.
    if category == "iphone":
        slug = group_key_for(entry.name, category, model).removeprefix("iphone-")
        if slug:
            product["page"] = f"/iphone-{slug}/"
    if category == "iphone":
        product.update(iphone_display_fields(entry.name))
    product.update(iphone_18_display_fields(entry.name, model))
    return product


def merge_products(products: list[dict], entries: list[PriceEntry]) -> tuple[list[dict], dict[str, int]]:
    has_iphone18_entries = any(is_iphone_18(entry.name) for entry in entries)
    legacy18_removed = 0
    if has_iphone18_entries:
        legacy18_removed = sum(
            is_iphone_18(product.get("name", "")) and product.get("source") != "icenter"
            for product in products
        )
        products[:] = [
            product for product in products
            if not (is_iphone_18(product.get("name", "")) and product.get("source") != "icenter")
        ]

    by_key: dict[str, list[int]] = {}
    for index, product in enumerate(products):
        by_key.setdefault(normal_key(product.get("name", "")), []).append(index)
    seen: set[int] = set()
    represented_categories = {category_for(entry.name) for entry in entries}
    stats = {"updated": 0, "added": 0, "unavailable": 0, "legacy18_removed": legacy18_removed}
    for entry in entries:
        matches = [index for index in by_key.get(entry.key, []) if index not in seen]
        if matches:
            index = min(matches, key=lambda item: products[item].get("source") == "icenter")
            product = products[index]
            price = entry.supplier_price + markup_for(entry.supplier_price)
            category = category_for(entry.name)
            model = model_for(entry.name, category)
            product.update(price=price, available=True, transit=entry.transit, source="icenter", category=category, model=model,
                           groupKey=(group_key_for(entry.name, category, model) if (re.match(r"^\\s*Fitbit\\s+Air\\b", entry.name, re.I) or re.match(r"^\\s*Ultra\\s*4(?:\\s|$)", entry.name, re.I)) else (product.get("groupKey") or group_key_for(entry.name, category, model))),
                           meta=("В пути" if entry.transit else "В наличии · Цена обновляется автоматически"),
                           url=whatsapp_url(product["name"], price, True))
            if category == "iphone":
                slug = group_key_for(entry.name, category, model).removeprefix("iphone-")
                if slug:
                    product["page"] = f"/iphone-{slug}/"
            if category == "iphone":
                product.update(iphone_display_fields(entry.name))
            product.update(iphone_18_display_fields(entry.name, model))
            seen.add(index); stats["updated"] += 1
        elif not matches:
            products.append(new_product(entry))
            index = len(products) - 1
            by_key.setdefault(entry.key, []).append(index)
            seen.add(index); stats["added"] += 1
    # Keep all Apple Watch products in the Apple Watch category, including
    # supplier shorthand such as "Ultra 4 ..." and temporarily unavailable items.
    for product in products:
        name = product.get("name", "")
        is_apple_watch = bool(re.match(r"^\s*Apple\s+Watch\b", name, re.I))
        is_ultra4_shorthand = (
            "samsung" not in name.lower() and "galaxy" not in name.lower()
            and bool(re.match(r"^\s*Ultra\s*4(?:\s|$)", name, re.I))
        )
        if is_apple_watch or is_ultra4_shorthand:
            model = model_for(name, "watch")
            product["category"] = "watch"
            product["model"] = model
            product["groupKey"] = group_key_for(name, "watch", model)

    for index, product in enumerate(products):
        if (index in seen
                or product.get("source") != "icenter"
                or product.get("category") not in represented_categories):
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


def update_catalog_fallback_cards(source: str, products: list[dict]) -> str:
    by_id: dict[str, list[dict]] = {}
    by_group: dict[str, list[dict]] = {}
    for product in products:
        if product.get("id") is not None:
            by_id.setdefault(str(product["id"]), []).append(product)
        if product.get("groupKey"):
            by_group.setdefault(str(product["groupKey"]), []).append(product)

    def replace_card(match: re.Match[str]) -> str:
        key = match.group(2)
        variants = by_group.get(key) or by_id.get(key)
        if not variants:
            return match.group(0)
        available = [p for p in variants if p.get("available", True) is not False and isinstance(p.get("price"), int)]
        pool = available or [p for p in variants if isinstance(p.get("price"), int)]
        if not pool:
            return match.group(0)
        minimum = min(int(p["price"]) for p in pool)
        body = match.group(3)
        current = CARD_PRICE_RE.search(body)
        if not current:
            return match.group(0)
        current_text = html.unescape(current.group(2)).strip().lower()
        prefix = "от " if current_text.startswith("от ") else ""
        price_text = prefix + f"{minimum:,}".replace(",", "&nbsp;") + " ₽"
        body = CARD_PRICE_RE.sub(lambda m: m.group(1) + price_text + m.group(3), body, count=1)
        return match.group(1) + body + match.group(4)

    return CATALOG_CARD_RE.sub(replace_card, source)


def save_products(source: str, products: list[dict], path: Path = CATALOG_PATH) -> None:
    updated, count = CATALOG_RE.subn(lambda m: m.group(1) + safe_json(products) + m.group(3), source, count=1)
    if count != 1: raise RuntimeError("Не удалось обновить catalog-data")
    updated = update_catalog_fallback_cards(updated, products)
    path.write_text(updated, encoding="utf-8")


def _status_meta(old_meta: str, available: bool) -> str:
    base = re.sub(r"\s*·\s*(?:Наличие.*|Нет в наличии.*|Срок.*)$", "", old_meta or "", flags=re.I).strip(" ·")
    status = "Наличие уточняйте перед покупкой" if available else "Нет в наличии"
    return f"{base} · {status}" if base else status


def update_home_prices(products: list[dict], path: Path = HOME_PATH) -> int:
    source = path.read_text(encoding="utf-8")
    if 'id="live-stock-products"' in source:
        return 0
    updated = source
    changed_cards = 0
    for group_key, page in (
        ("iphone-18-pro", "/iphone-18-pro/"),
        ("iphone-18-pro-max", "/iphone-18-pro-max/"),
    ):
        variants = [
            product for product in products
            if product.get("groupKey") == group_key and isinstance(product.get("price"), int)
        ]
        available = [product for product in variants if product.get("available", True) is not False]
        pool = available or variants
        if not pool:
            continue
        minimum = min(int(product["price"]) for product in pool)
        formatted = "от " + f"{minimum:,}".replace(",", "&nbsp;") + " ₽"
        pattern = re.compile(
            r'(<a\s+class="product-card"\s+href="' + re.escape(page) +
            r'">.*?<div\s+class="price-row">\s*<strong>)(.*?)(</strong>)',
            re.DOTALL,
        )
        updated, count = pattern.subn(lambda match: match.group(1) + formatted + match.group(3), updated, count=1)
        if count != 1:
            raise RuntimeError(f"Не найдена карточка главной страницы для {group_key}")
        changed_cards += 1 if updated != source else 0
        source = updated
    path.write_text(updated, encoding="utf-8")
    return changed_cards


def update_detail_pages(products: list[dict]) -> int:
    by_page: dict[str, list[dict]] = {}
    for product in products:
        page = product.get("page")
        if not page or page in {"/choose/"}:
            continue
        by_page.setdefault(page, []).append(product)

    changed_pages = 0
    for page, current_variants in by_page.items():
        path = ROOT / page.strip("/") / "index.html"
        if not path.exists():
            continue

        source = path.read_text(encoding="utf-8")
        match = DETAIL_DATA_RE.search(source)
        if not match:
            continue

        page_data = json.loads(html.unescape(match.group(2)))
        old_variants = page_data.get("variants")
        if not isinstance(old_variants, list):
            continue

        replace_supplier_variants = page in {"/iphone-18-pro/", "/iphone-18-pro-max/"}
        if replace_supplier_variants:
            refreshed = [dict(fresh) for fresh in current_variants]
        else:
            by_id = {str(p.get("id")): p for p in current_variants if p.get("id") is not None}
            by_name = {normal_key(p.get("name", "")): p for p in current_variants if p.get("name")}
            refreshed: list[dict] = []
            seen: set[str] = set()

            for old in old_variants:
                fresh = by_id.get(str(old.get("id"))) or by_name.get(normal_key(old.get("name", "")))
                if not fresh:
                    refreshed.append(old)
                    continue

                item = dict(old)
                for field in ("price", "available", "url", "source", "category", "model", "memory",
                              "preorder", "notes", "transit", "groupKey", "page"):
                    if field in fresh:
                        item[field] = fresh[field]
                item["meta"] = _status_meta(old.get("meta", ""), fresh.get("available", True) is not False)
                refreshed.append(item)
                seen.add(str(fresh.get("id")))

            for fresh in current_variants:
                fresh_id = str(fresh.get("id"))
                if fresh_id not in seen and not any(normal_key(v.get("name", "")) == normal_key(fresh.get("name", "")) for v in refreshed):
                    refreshed.append(dict(fresh))

        page_data["variants"] = refreshed
        updated = DETAIL_DATA_RE.sub(
            lambda m: m.group(1) + safe_json(page_data) + m.group(3), source, count=1
        )

        priced = [v for v in refreshed if isinstance(v.get("price"), int) and v.get("available", True) is not False]
        if not priced:
            priced = [v for v in refreshed if isinstance(v.get("price"), int)]
        if priced:
            minimum = min(v["price"] for v in priced)
            def replace_price(m: re.Match[str]) -> str:
                current = html.unescape(m.group(2)).strip().lower()
                prefix = "от " if current.startswith("от ") else ""
                formatted = f"{minimum:,}".replace(",", "&nbsp;")
                return m.group(1) + prefix + formatted + " ₽" + m.group(3)
            updated = DETAIL_PRICE_RE.sub(replace_price, updated, count=1)

        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed_pages += 1

    return changed_pages


def update_yml(products: list[dict], path: Path = YML_PATH) -> None:
    categories = {"iphone": ("1", "iPhone"), "samsung": ("2", "Samsung"), "mac": ("3", "Mac"),
                  "ipad": ("4", "iPad"), "watch": ("5", "Apple Watch"), "airpods": ("6", "AirPods"),
                  "accessories": ("7", "Аксессуары"), "gaming": ("8", "Игры и PlayStation"),
                  "xiaomi": ("9", "Xiaomi, Redmi и Poco"), "honor": ("10", "Honor"),
                  "beauty": ("11", "Красота и уход"), "cameras": ("12", "Камеры и съёмка"),
                  "glasses": ("13", "Умные очки"), "collectibles": ("14", "Коллекционные товары")}
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
        vendor = {"samsung": "Samsung", "gaming": "Sony", "xiaomi": "Xiaomi", "honor": "Honor",
                  "beauty": "Dyson", "cameras": "А Маркет", "glasses": "А Маркет",
                  "collectibles": "А Маркет"}.get(category, "Apple")
        ET.SubElement(offer, "vendor").text = vendor
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
        scan_limit = int(os.getenv("TELEGRAM_SCAN_LIMIT", "1000"))
        async for message in client.iter_messages(entity, limit=scan_limit):
            if message.message:
                activity = message.edit_date or message.date
                messages.append((activity.astimezone(MOSCOW), message.id, message.message))
        if not messages: raise RuntimeError("В канале не найдены текстовые сообщения")
        # The supplier keeps one long price list split across several Telegram
        # messages and edits its sections at different times.  Selecting only
        # the newest edit day drops untouched sections (for example PS5).
        price_messages = [item for item in messages if parse_price_text(item[2])]
        if not price_messages:
            raise RuntimeError("В канале не найдены сообщения с ценами")
        # Select the most recently active price messages. Resolve duplicate
        # products here, message by message: the newest edited/posted message
        # must always win. This avoids an older price section overriding a fresh edit.
        batch_size = int(os.getenv("TELEGRAM_BATCH_MESSAGES", "120"))
        newest = sorted(price_messages, key=lambda item: (item[0], item[1]), reverse=True)[:batch_size]
        # Temporary diagnostic for the iPhone 18 Pro Max supplier section.
        # It reveals exactly which Telegram message/edit the API exposes to Actions.
        for activity, message_id, message_text in newest:
            if "18 Pro Max 256GB Black" in message_text:
                rows = [line.strip() for line in message_text.splitlines() if "18 Pro Max 256GB Black" in line]
                print(f"TG_DIAG message={message_id} activity={activity.isoformat()} rows={rows}", file=sys.stderr)
        latest_entries = {}
        for activity, message_id, message_text in newest:
            for entry in parse_price_text(message_text):
                if entry.key not in latest_entries:
                    latest_entries[entry.key] = entry
        return "\n".join(
            f"{entry.name} - {entry.supplier_price:,}".replace(",", ".") + (" ✈️" if entry.transit else "")
            for entry in latest_entries.values()
        )


def run(text: str, minimum: int) -> dict[str, int]:
    entries = parse_price_text(text)
    source, products = load_products()
    managed = len(products)
    safe_minimum = max(minimum, min(100, (managed * 45 + 99) // 100))
    if len(entries) < safe_minimum:
        raise RuntimeError(f"Защитная остановка: распознано только {len(entries)} позиций, безопасный минимум {safe_minimum}. Каталог не изменён.")
    merged, stats = merge_products(products, entries)
    save_products(source, merged)
    detail_pages = update_detail_pages(merged)
    home_cards = update_home_prices(merged)
    update_yml(merged)
    stats.update(parsed=len(entries), total=len(merged), detail_pages=detail_pages, home_cards=home_cards)
    return stats


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

import copy, tempfile, unittest
from pathlib import Path
from telegram_price_sync import category_for, markup_for, merge_products, normal_key, parse_price_text, update_home_prices

class PriceSyncTests(unittest.TestCase):
    def setUp(self):
        self.products = [
            {"id":"iphone18","name":"iPhone 18 Pro 256GB Black eSIM","category":"iphone","model":"iPhone 18 Pro","price":121990,"meta":"В наличии","url":"https://wa.me/1"},
            {"id":"airpods","name":"AirPods 4","category":"airpods","model":"AirPods 4","price":12000,"meta":"В наличии","url":"https://wa.me/1"},
            {"id":"old","name":"Magic Mouse 3 White","category":"accessories","model":"Magic Mouse 3 White","price":8990,"meta":"В наличии","url":"https://wa.me/1"},]
    def test_parser_updates_iphone_18(self):
        text="""iCenter Stavropol, [29 сен. 2026 в 10:00]\n▪️ Audio\nAirPods 4 - 10.000\n18 Pro 256GB Black 🇯🇵 - 116.500\nDualSense PS5 White - 5.900\nОт 10 шт - 1.650\n"""
        entries=parse_price_text(text); self.assertEqual({x.supplier_price for x in entries},{10000,116500,5900})
        self.assertEqual(category_for("18 Pro Max 256 Black"), "iphone")
        self.assertEqual(normal_key("iPhone 17 Pro 256GB Blue 🇯🇵"),normal_key("17 Pro 256 Blue 🇯🇵"))
        merged,stats=merge_products(copy.deepcopy(self.products),entries)
        self.assertFalse(any(x.get("id")=="iphone18" for x in merged))
        iphone18=next(x for x in merged if x["name"]=="18 Pro 256GB Black 🇯🇵")
        airpods=next(x for x in merged if x["id"]=="airpods")
        old=next(x for x in merged if x["id"]=="old"); dualsense=next(x for x in merged if x["name"]=="DualSense PS5 White")
        self.assertEqual(iphone18["price"],118500); self.assertEqual(iphone18["category"],"iphone")
        self.assertEqual(iphone18["color"],"Black"); self.assertEqual(iphone18["region"],"🇯🇵")
        self.assertEqual(iphone18["page"],"/iphone-18-pro/"); self.assertEqual(stats["legacy18_removed"],1)
        self.assertEqual(airpods["price"],12000); self.assertTrue(airpods["available"])
        self.assertTrue(old.get("available",True)); self.assertEqual(dualsense["price"],6900); self.assertEqual(dualsense["category"],"gaming")

    def test_short_supplier_names_are_categorized_and_matched(self):
        self.assertEqual(category_for("S26 Ultra 12/256GB Black 🇦🇪"), "samsung")
        self.assertEqual(category_for("Air 11 M4 Wi-Fi 128GB Blue 🇺🇸"), "ipad")
        self.assertEqual(category_for("SE 3 40mm Starlight"), "watch")
        self.assertEqual(category_for("Air 15 M5 16/512GB Midnight"), "mac")
        self.assertEqual(category_for("Air 13 M4 Wi-Fi 128GB Blue"), "ipad")
        self.assertEqual(category_for("Poco F9 Pro 12/512GB Black"), "xiaomi")
        self.assertEqual(category_for("17E 256GB Black"), "iphone")
        self.assertEqual(normal_key("Samsung Galaxy S26 Ultra 12/256GB Black 🇦🇪"),
                         normal_key("S26 Ultra 12/256GB Black 🇦🇪"))
        self.assertEqual(markup_for(9_999), 1_000)
        self.assertEqual(markup_for(10_000), 2_000)

    def test_short_samsung_name_updates_existing_card_without_duplicate(self):
        products = [{"id":"s26","name":"Samsung Galaxy S26 Ultra 12/256GB Black 🇦🇪",
                     "category":"samsung","model":"Samsung Galaxy S26 Ultra","price":80990,
                     "groupKey":"samsung-s26-ultra","available":True}]
        entries = parse_price_text("S26 Ultra 12/256GB Black 🇦🇪 - 78.000")
        merged, stats = merge_products(products, entries)
        self.assertEqual(len(merged), 1)
        self.assertEqual(stats["updated"], 1)
        self.assertEqual(stats["added"], 0)
        self.assertEqual(merged[0]["price"], 80_000)

    def test_home_prices_follow_live_iphone18_minimums(self):
        html = '<a class="product-card" href="/iphone-18-pro/"><div class="price-row"><strong>от 121&nbsp;990 ₽</strong></div></a>' \
               '<a class="product-card" href="/iphone-18-pro-max/"><div class="price-row"><strong>от 142&nbsp;990 ₽</strong></div></a>'
        products = [
            {"groupKey":"iphone-18-pro","price":118500,"available":True},
            {"groupKey":"iphone-18-pro","price":117000,"available":True},
            {"groupKey":"iphone-18-pro-max","price":136500,"available":True},
            {"groupKey":"iphone-18-pro-max","price":133500,"available":True},
        ]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "index.html"
            path.write_text(html, encoding="utf-8")
            update_home_prices(products, path)
            updated = path.read_text(encoding="utf-8")
        self.assertIn("от 117&nbsp;000 ₽", updated)
        self.assertIn("от 133&nbsp;500 ₽", updated)
        self.assertNotIn("121&nbsp;990", updated)
        self.assertNotIn("142&nbsp;990", updated)

    def test_live_home_block_skips_legacy_price_rewrite(self):
        html = '<div id="live-stock-products"></div>'
        products = [{"groupKey":"iphone-18-pro","price":117000,"available":True}]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "index.html"
            path.write_text(html, encoding="utf-8")
            changed = update_home_prices(products, path)
            updated = path.read_text(encoding="utf-8")
        self.assertEqual(changed, 0)
        self.assertEqual(updated, html)

    def test_partial_supplier_batch_does_not_disable_unrepresented_category(self):
        products = [
            {"id":"ps5","name":"DualSense PS5 White","category":"gaming","model":"DualSense",
             "price":6900,"available":True,"source":"icenter"},
            {"id":"mouse","name":"Magic Mouse 3 White","category":"accessories","model":"Magic Mouse 3 White",
             "price":8000,"available":True,"source":"icenter"},
        ]
        entries = parse_price_text("Magic Mouse 3 White - 7.000")
        merged, stats = merge_products(products, entries)
        dualsense = next(x for x in merged if x["id"] == "ps5")
        self.assertTrue(dualsense["available"])
        self.assertEqual(stats["unavailable"], 0)

if __name__ == "__main__": unittest.main()

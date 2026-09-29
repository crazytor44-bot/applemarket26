import copy, unittest
from telegram_price_sync import category_for, is_iphone_18, markup_for, merge_products, normal_key, parse_price_text

class PriceSyncTests(unittest.TestCase):
    def setUp(self):
        self.products = [
            {"id":"protected","name":"iPhone 18 Pro 256GB Black eSIM","category":"iphone","model":"iPhone 18 Pro","price":121990,"meta":"В наличии","url":"https://wa.me/1"},
            {"id":"airpods","name":"AirPods 4","category":"airpods","model":"AirPods 4","price":12000,"meta":"В наличии","url":"https://wa.me/1"},
            {"id":"old","name":"Magic Mouse 3 White","category":"accessories","model":"Magic Mouse 3 White","price":8990,"meta":"В наличии","url":"https://wa.me/1"},]
    def test_parser_and_protection(self):
        text="""iCenter Stavropol, [29 сен. 2026 в 10:00]\n▪️ Audio\nAirPods 4 - 10.000\n18 Pro 256 Black eSIM - 135.000\nDualSense PS5 White - 5.900\nОт 10 шт - 1.650\n"""
        entries=parse_price_text(text); self.assertEqual({x.supplier_price for x in entries},{10000,5900})
        self.assertTrue(is_iphone_18("18 Pro Max 256 Black"))
        self.assertEqual(normal_key("iPhone 17 Pro 256GB Blue 🇯🇵"),normal_key("17 Pro 256 Blue 🇯🇵"))
        merged,stats=merge_products(copy.deepcopy(self.products),entries)
        protected=next(x for x in merged if x["id"]=="protected"); airpods=next(x for x in merged if x["id"]=="airpods")
        old=next(x for x in merged if x["id"]=="old"); dualsense=next(x for x in merged if x["name"]=="DualSense PS5 White")
        self.assertEqual(protected["price"],121990); self.assertEqual(airpods["price"],12000); self.assertTrue(airpods["available"])
        self.assertTrue(old.get("available",True)); self.assertEqual(dualsense["price"],6900); self.assertEqual(dualsense["category"],"gaming")
        self.assertEqual(stats["protected18"],1)

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

if __name__ == "__main__": unittest.main()

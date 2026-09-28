import copy, unittest
from telegram_price_sync import is_iphone_18, merge_products, normal_key, parse_price_text

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
        self.assertFalse(old["available"]); self.assertEqual(dualsense["price"],7900); self.assertEqual(dualsense["category"],"gaming")
        self.assertEqual(stats["protected18"],1)

if __name__ == "__main__": unittest.main()

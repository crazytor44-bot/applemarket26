"""Safe tests: GitHub receipt and Telegram calls are mocked, never sent."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

module_stub = types.ModuleType("publisher")
module_stub.CHAT = "@applemarket26"
module_stub.verify = lambda **kwargs: None
sys.modules["publisher"] = module_stub

script = Path(__file__).resolve().parents[1] / "post_queue.py"
spec = importlib.util.spec_from_file_location("amarket_test_post_queue", str(script))
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class PostQueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.oldcwd = os.getcwd()
        os.chdir(self.tmp.name)
        Path("telegram_channel/post_queue").mkdir(parents=True)
        Path("telegram_channel/media").mkdir(parents=True)
        self.photo = Path("telegram_channel/media/test.jpg")
        self.photo.write_bytes(bytes([255, 216]) + b"pretend-jpeg-for-validation-only" * 60)
        blob = self.photo.read_bytes()
        sha = hashlib.sha1(b"blob " + str(len(blob)).encode() + b"\0" + blob).hexdigest()
        self.post = {
            "approved": True, "channel": "@applemarket26",
            "publish_at": "2099-10-18T09:00:00+03:00",
            "text": "Утверждённая подпись", "parse_mode": "plain", "pin": False,
            "photo_repository_path": str(self.photo), "photo_git_blob_sha": sha
        }
        self.path = Path("telegram_channel/post_queue/2099-10-18-demo-post.json")
        self.save()

    def save(self):
        self.path.write_text(json.dumps(self.post, ensure_ascii=False), encoding="utf-8")

    def tearDown(self):
        os.chdir(self.oldcwd)
        self.tmp.cleanup()

    def test_valid_approval(self):
        post, due, photo, mime = app.validate(self.path)
        self.assertEqual(post["text"], "Утверждённая подпись")
        self.assertEqual(mime, "image/jpeg")
        self.assertEqual(due.hour, 9)

    def test_refuses_unapproved_or_pinned(self):
        self.post["approved"] = False
        self.save()
        with self.assertRaises(RuntimeError):
            app.validate(self.path)
        self.post["approved"] = True
        self.post["pin"] = True
        self.save()
        with self.assertRaises(RuntimeError):
            app.validate(self.path)

    def test_rejects_changed_photo(self):
        self.photo.write_bytes(bytes([255,216]) + b"x"*1200)
        with self.assertRaises(RuntimeError):
            app.validate(self.path)

    def test_future_posts_never_send_early(self):
        with patch.object(app, "verify") as v, patch.object(app, "send") as send:
            app.main(False)
            v.assert_not_called()
            send.assert_not_called()

    def test_existing_receipt_blocks_duplicate(self):
        with patch.object(app, "github", side_effect=[FileExistsError(), {"sha":"claimed"}]):
            self.assertIsNone(app.claim(self.path, self.post))

    def test_text_post_without_image(self):
        self.post.pop("photo_repository_path")
        self.post.pop("photo_git_blob_sha")
        self.post["kind"] = "text"
        self.save()
        post, due, media, mime = app.validate(self.path)
        self.assertEqual(mime, "text")
        self.assertEqual(media, b"")

    def test_poll_requires_options(self):
        self.post.pop("photo_repository_path")
        self.post.pop("photo_git_blob_sha")
        self.post["kind"] = "poll"
        self.post["text"] = "Как часто чистишь фото?"
        self.post["options"] = ["Раз в неделю", "Никогда", "Когда память кончается"]
        self.save()
        post, due, media, mime = app.validate(self.path)
        self.assertEqual(mime, "poll")
        self.post["options"] = ["Повтор", "Повтор"]
        self.save()
        with self.assertRaises(RuntimeError):
            app.validate(self.path)

    def test_text_disallows_photo_and_missing_approval(self):
        self.post["kind"] = "text"
        self.save()
        with self.assertRaises(RuntimeError):
            app.validate(self.path)
        self.post.pop("photo_repository_path")
        self.post.pop("photo_git_blob_sha")
        self.post["approved"] = False
        self.save()
        with self.assertRaises(RuntimeError):
            app.validate(self.path)

    def test_due_approved_post_sends_once(self):
        due = datetime.now(ZoneInfo("Europe/Moscow")) - timedelta(minutes=2)
        self.post["publish_at"] = due.isoformat()
        self.path.unlink()
        self.path = Path("telegram_channel/post_queue/"+due.strftime("%Y-%m-%d")+"-demo-post.json")
        self.save()
        with patch.object(app, "verify") as verify, patch.object(app, "duplicate_on_public_feed", return_value=False), \
             patch.object(app, "claim", return_value="receiptsha") as claim, \
             patch.object(app, "send", return_value=66) as send, \
             patch.object(app, "verify_public_message", return_value=True) as public_verify, \
             patch.object(app, "update_receipt") as receipt:
            app.main(False)
            verify.assert_called_once()
            claim.assert_called_once()
            send.assert_called_once()
            public_verify.assert_called_once_with(66, self.post["text"])
            receipt.assert_called_once_with(self.path, "receiptsha", 66, True)

    def test_public_verification_failure_is_recorded_and_raised(self):
        due = datetime.now(ZoneInfo("Europe/Moscow")) - timedelta(minutes=2)
        self.post["publish_at"] = due.isoformat()
        self.path.unlink()
        self.path = Path("telegram_channel/post_queue/"+due.strftime("%Y-%m-%d")+"-verify-failure.json")
        self.save()
        with patch.object(app, "verify"), patch.object(app, "duplicate_on_public_feed", return_value=False), \
             patch.object(app, "claim", return_value="receiptsha"), \
             patch.object(app, "send", return_value=67), \
             patch.object(app, "verify_public_message", return_value=False), \
             patch.object(app, "update_receipt") as receipt:
            with self.assertRaises(RuntimeError):
                app.main(False)
            receipt.assert_called_once_with(self.path, "receiptsha", 67, False)


if __name__ == "__main__":
    unittest.main()

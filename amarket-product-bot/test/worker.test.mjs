import test from "node:test";
import assert from "node:assert/strict";
import { buildTelegramCaption, verifyTelegramInitData } from "../src/worker.js";

const enc = new TextEncoder();
async function sign(token, entries) {
  const hmac = async (keyBytes, value) => {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
  };
  const secret = await hmac(enc.encode("WebAppData"), token);
  const check = [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const hash = [...await hmac(secret, check)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new URLSearchParams([...entries, ["hash", hash]]).toString();
}

test("validates Telegram initData", async () => {
  const token = "123456:test-token";
  const entries = [["auth_date", String(Math.floor(Date.now() / 1000))], ["query_id", "AAE"], ["signature", "new-telegram-signature"], ["user", JSON.stringify({ id: 42, first_name: "Эрик" })]];
  const result = await verifyTelegramInitData(await sign(token, entries), token);
  assert.equal(result.ok, true);
  assert.equal(result.user.id, 42);
});

test("rejects modified initData", async () => {
  const token = "123456:test-token";
  const entries = [["auth_date", String(Math.floor(Date.now() / 1000))], ["user", JSON.stringify({ id: 42 })]];
  const signed = await sign(token, entries);
  const modified = new URLSearchParams(signed);
  modified.set("user", JSON.stringify({ id: 99 }));
  const result = await verifyTelegramInitData(modified.toString(), token);
  assert.equal(result.ok, false);
});

test("accepts a signed Telegram session several hours old", async () => {
  const token = "123456:test-token";
  const entries = [["auth_date", String(Math.floor(Date.now() / 1000) - 6 * 60 * 60)], ["user", JSON.stringify({ id: 42 })]];
  const result = await verifyTelegramInitData(await sign(token, entries), token);
  assert.equal(result.ok, true);
});

test("creates A Market caption", () => {
  const caption = buildTelegramCaption({ model: "iPhone 16 Pro Max", storage: "256 ГБ", color: "Чёрный", price: "67990", battery: "89%", sim: "SIM + eSIM", condition: "Отличное" });
  assert.match(caption, /67.990 ₽/);
  assert.match(caption, /Тухачевского, 16/);
  assert.match(caption, /https:\/\/applemarket26\.ru/);
  assert.match(caption, /https:\/\/t\.me\/\+79383119888/);
});

test("keeps each client's branding isolated", () => {
  const caption = buildTelegramCaption(
    { model: "iPhone 15", storage: "128 Gb", price: "35990", condition: "Отличное" },
    { store_name: "Техно Дом", address: "Москва, Тверская, 1", website: "technodom.example", telegram_contact: "@technodom", active: 1 },
  );
  assert.match(caption, /Техно Дом/);
  assert.match(caption, /https:\/\/technodom\.example/);
  assert.match(caption, /https:\/\/t\.me\/technodom/);
  assert.doesNotMatch(caption, /А Маркет|applemarket26|Тухачевского/);
});

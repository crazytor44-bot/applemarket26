import { APP_HTML } from "./app-page.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const encoder = new TextEncoder();

async function hmac(keyBytes, value) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

const toHex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

export async function verifyTelegramInitData(initData, botToken, maxAgeSeconds = 900) {
  if (!initData || !botToken) return { ok: false, reason: "missing_data" };
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash") || "";
  params.delete("hash");
  params.delete("signature");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const calculatedHash = toHex(await hmac(secret, dataCheckString));
  if (!safeEqual(calculatedHash, suppliedHash)) return { ok: false, reason: "invalid_hash" };
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) return { ok: false, reason: "expired" };
  try {
    return { ok: true, user: JSON.parse(params.get("user") || "{}") };
  } catch {
    return { ok: false, reason: "invalid_user" };
  }
}

const clean = (value, limit = 160) => String(value || "").replace(/[<>]/g, "").trim().slice(0, limit);
const price = (value) => {
  const number = Number(String(value || "").replace(/\D/g, ""));
  return number ? `${new Intl.NumberFormat("ru-RU").format(number)} ₽` : "Цена по запросу";
};

export function buildTelegramCaption(product) {
  const p = Object.fromEntries(Object.entries(product || {}).map(([key, value]) => [key, clean(value, key === "notes" ? 300 : 160)]));
  const details = [p.storage, p.color, p.battery && `АКБ ${p.battery}`, p.sim].filter(Boolean).join(" · ");
  return [`📱 ${p.model} ${p.storage}`.trim(), "", details, p.condition && `Состояние: ${p.condition}`, p.warranty && `Гарантия: ${p.warranty}`, p.notes, "", `💳 ${price(p.price)}`, "", "📍 А Маркет, Ставрополь, Тухачевского, 16"].filter((line) => line !== false && line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1024);
}

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: payload instanceof FormData ? undefined : { "content-type": "application/json" },
    body: payload instanceof FormData ? payload : JSON.stringify(payload)
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || `Telegram ${method} failed`);
  return result.result;
}

async function handleWebhook(request, env) {
  if (env.WEBHOOK_SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return json({ ok: false }, 403);
  const update = await request.json();
  const message = update.message;
  if (!message?.chat?.id) return json({ ok: true });
  if ((message.text || "").startsWith("/start")) {
    const appUrl = `${new URL(request.url).origin}/app`;
    await telegram(env, "sendMessage", {
      chat_id: message.chat.id,
      text: `А Маркет · Один товар\n\nВаш Telegram ID: ${message.from.id}\n\nДобавьте товар один раз и получите материалы для всех площадок.`,
      reply_markup: { inline_keyboard: [[{ text: "Добавить товар", web_app: { url: appUrl } }]] }
    });
  }
  return json({ ok: true });
}

function allowedUser(env, userId) {
  const ids = String(env.ALLOWED_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) return null;
  const raw = atob(match[2]);
  if (raw.length > 9_000_000) return null;
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

async function publishToTelegram(request, env) {
  const body = await request.json();
  const auth = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth.ok) return json({ ok: false, error: "Откройте приложение внутри Telegram ещё раз." }, 401);
  if (!allowedUser(env, auth.user?.id)) return json({ ok: false, error: `Нет доступа. Ваш Telegram ID: ${auth.user?.id || "не определён"}` }, 403);
  const caption = buildTelegramCaption(body.product);
  const image = dataUrlToBlob(body.imageDataUrl);
  if (image) {
    const form = new FormData();
    form.set("chat_id", env.CHANNEL_ID);
    form.set("caption", caption);
    form.set("photo", image, "product.jpg");
    await telegram(env, "sendPhoto", form);
  } else {
    await telegram(env, "sendMessage", { chat_id: env.CHANNEL_ID, text: caption });
  }
  return json({ ok: true });
}

async function sendFileToUser(request, env) {
  const body = await request.json();
  const auth = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth.ok) return json({ ok: false, error: "Откройте приложение внутри Telegram ещё раз." }, 401);
  if (!allowedUser(env, auth.user?.id)) return json({ ok: false, error: `Нет доступа. Ваш Telegram ID: ${auth.user?.id || "не определён"}` }, 403);
  const image = dataUrlToBlob(body.imageDataUrl);
  if (!image) return json({ ok: false, error: "Не удалось подготовить изображение." }, 400);
  const fileName = clean(body.fileName, 120).replace(/[^a-zA-Zа-яА-ЯёЁ0-9._-]+/g, "-") || "amarket-file.png";
  const form = new FormData();
  form.set("chat_id", String(auth.user.id));
  form.set("caption", "А Маркет · готовый файл");
  form.set("document", image, fileName);
  await telegram(env, "sendDocument", form);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
      return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org" } });
    }
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "amarket-product-bot" });
    if (request.method === "POST" && url.pathname === "/telegram/webhook") return handleWebhook(request, env);
    if (request.method === "POST" && url.pathname === "/api/publish/telegram") return publishToTelegram(request, env);
    if (request.method === "POST" && url.pathname === "/api/send/file") return sendFileToUser(request, env);
    return new Response("Not found", { status: 404 });
  }
};

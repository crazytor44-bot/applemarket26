import { APP_HTML } from "./app-page.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const encoder = new TextEncoder();
const AMARKET_PROFILE = Object.freeze({ store_name: "А Маркет", legal_footer: "ИП Мкртичян Эрик Генадьевич", address: "Ставрополь, Тухачевского, 16", website: "https://applemarket26.ru", telegram_contact: "https://t.me/+79383119888", channel_id: "@applemarket26", active: 1, subscription_until: null });

async function hmac(keyBytes, value) { const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))); }
const toHex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
function safeEqual(left, right) { if (left.length !== right.length) return false; let result = 0; for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i); return result === 0; }

export async function verifyTelegramInitData(initData, botToken, maxAgeSeconds = 604800) {
  if (!initData || !botToken) return { ok: false, reason: "missing_data" };
  const params = new URLSearchParams(initData); const suppliedHash = params.get("hash") || ""; params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), botToken); const calculatedHash = toHex(await hmac(secret, dataCheckString));
  if (!safeEqual(calculatedHash, suppliedHash)) return { ok: false, reason: "invalid_hash" };
  const authDate = Number(params.get("auth_date")); if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) return { ok: false, reason: "expired" };
  try { return { ok: true, user: JSON.parse(params.get("user") || "{}") }; } catch { return { ok: false, reason: "invalid_user" }; }
}

const clean = (value, limit = 160) => String(value || "").replace(/[<>]/g, "").trim().slice(0, limit);
const price = (value) => { const number = Number(String(value || "").replace(/\D/g, "")); return number ? `${new Intl.NumberFormat("ru-RU").format(number)} ₽` : "Цена по запросу"; };
const normalizeUrl = (value) => { const text = clean(value, 240); if (!text) return ""; if (/^https?:\/\//i.test(text)) return text; return `https://${text.replace(/^\/+/, "")}`; };
const normalizeTelegram = (value) => { const text = clean(value, 240); if (!text) return ""; if (/^https?:\/\//i.test(text)) return text; if (text.startsWith("@")) return `https://t.me/${text.slice(1)}`; if (/^\+?\d{7,15}$/.test(text)) return `https://t.me/+${text.replace(/\D/g, "")}`; return normalizeUrl(text); };
const adminIds = (env) => String(env.ALLOWED_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
const isAdmin = (env, userId) => adminIds(env).includes(String(userId));
const canUse = (profile, admin = false) => admin || Boolean(profile?.active && (!profile.subscription_until || Date.parse(profile.subscription_until) > Date.now()));
const publicProfile = (profile, admin = false) => ({ telegram_user_id: String(profile.telegram_user_id || ""), store_name: clean(profile.store_name, 80), legal_footer: clean(profile.legal_footer, 100), address: clean(profile.address, 160), website: normalizeUrl(profile.website), telegram_contact: normalizeTelegram(profile.telegram_contact), channel_id: clean(profile.channel_id, 100), active: Number(profile.active || 0), subscription_until: profile.subscription_until || null, is_admin: admin, can_use: canUse(profile, admin) });

const profileStub = (env, userId) => env.PROFILES.get(env.PROFILES.idFromName(String(userId)));
async function readProfile(env, userId) { const response = await profileStub(env, userId).fetch("https://profiles.internal/profile"); return response.json(); }
async function writeProfile(env, userId, values) { const response = await profileStub(env, userId).fetch("https://profiles.internal/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); return response.json(); }

export class StoreProfile {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    if (request.method === "GET") return json(await this.storage.get("profile") || null);
    if (request.method === "PUT") {
      const incoming = await request.json(); const existing = await this.storage.get("profile") || {};
      const profile = { ...existing, ...incoming, updated_at: new Date().toISOString() };
      await this.storage.put("profile", profile); return json(profile);
    }
    return new Response("Not found", { status: 404 });
  }
}

async function ensureProfile(env, userId) {
  const id = String(userId); const admin = isAdmin(env, id);
  if (!env.PROFILES) return publicProfile({ telegram_user_id: id, ...(admin ? AMARKET_PROFILE : {}) }, admin);
  let profile = await readProfile(env, id);
  if (!profile) {
    const seed = admin ? { ...AMARKET_PROFILE, channel_id: env.CHANNEL_ID || AMARKET_PROFILE.channel_id } : { store_name: "Мой магазин", legal_footer: "", address: "", website: "", telegram_contact: "", channel_id: "", active: 0, subscription_until: null };
    profile = await writeProfile(env, id, { telegram_user_id: id, ...seed, created_at: new Date().toISOString() });
  }
  return publicProfile(profile, admin);
}

export function buildTelegramCaption(product, profile = AMARKET_PROFILE) {
  const raw = product || {}; const p = Object.fromEntries(Object.entries(raw).filter(([, value]) => !Array.isArray(value) && typeof value !== "object").map(([key, value]) => [key, clean(value, key === "notes" ? 300 : 160)])); const shop = publicProfile(profile);
  const attributes = Array.isArray(raw.attributes) ? raw.attributes.slice(0, 6).map((item) => ({ label: clean(item?.label, 50), value: clean(item?.value, 100) })).filter((item) => item.value) : [];
  const details = attributes.length ? attributes.map((item) => `${item.label}: ${item.value}`).join(" · ") : [p.storage, p.color, p.battery && `АКБ ${p.battery}`, p.sim].filter(Boolean).join(" · ");
  const icon = p.category === "iphone" || p.category === "android" ? "📱" : p.category === "laptop" ? "💻" : p.category === "fashion" ? "👟" : "📦";
  return [`${icon} ${p.model} ${attributes.length ? "" : p.storage || ""}`.trim(), "", details, p.condition && `Состояние: ${p.condition}`, p.warranty && `Гарантия: ${p.warranty}`, p.notes, "", `💳 ${price(p.price)}`, "", shop.store_name && `🏪 ${shop.store_name}`, shop.address && `📍 ${shop.address}`, shop.website && `🌐 Сайт: ${shop.website}`, shop.telegram_contact && `💬 Написать в Telegram: ${shop.telegram_contact}`].filter((line) => line !== false && line !== undefined && line !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1024);
}

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: payload instanceof FormData ? undefined : { "content-type": "application/json" }, body: payload instanceof FormData ? payload : JSON.stringify(payload) });
  const result = await response.json(); if (!result.ok) throw new Error(result.description || `Telegram ${method} failed`); return result.result;
}

async function handleWebhook(request, env) {
  if (env.WEBHOOK_SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return json({ ok: false }, 403);
  const update = await request.json(); const message = update.message; if (!message?.chat?.id) return json({ ok: true });
  if ((message.text || "").startsWith("/start")) {
    const profile = await ensureProfile(env, message.from.id); const appUrl = `${new URL(request.url).origin}/app`;
    const accessText = profile.can_use ? `${profile.store_name || "Магазин"} · материалы товара\n\nВаш Telegram ID: ${message.from.id}` : `Доступ пока не активирован.\n\nВаш Telegram ID: ${message.from.id}\nПередайте этот ID владельцу сервиса.`;
    await telegram(env, "sendMessage", { chat_id: message.chat.id, text: accessText, ...(profile.can_use ? { reply_markup: { inline_keyboard: [[{ text: "Открыть генератор", web_app: { url: appUrl } }]] } } : {}) });
  }
  return json({ ok: true });
}

function dataUrlToBlob(dataUrl) { const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || ""); if (!match) return null; const raw = atob(match[2]); if (raw.length > 9_000_000) return null; const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0)); return new Blob([bytes], { type: match[1] }); }

async function authenticatedBody(request, env, requireAccess = false) {
  const body = await request.json(); const auth = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth.ok) return { response: json({ ok: false, error: "Откройте приложение внутри Telegram ещё раз." }, 401) };
  const profile = await ensureProfile(env, auth.user?.id); if (requireAccess && !profile.can_use) return { response: json({ ok: false, error: "Подписка не активна. Обратитесь к владельцу сервиса." }, 403) };
  return { body, auth, profile };
}

async function getProfile(request, env) { const context = await authenticatedBody(request, env); if (context.response) return context.response; return json({ ok: true, profile: context.profile }); }

async function saveProfile(request, env) {
  const context = await authenticatedBody(request, env); if (context.response) return context.response; if (!env.PROFILES) return json({ ok: false, error: "Хранилище профилей ещё не подключено." }, 503);
  const incoming = context.body.profile || {}; const channel = clean(incoming.channel_id, 100);
  if (channel && !/^@[A-Za-z0-9_]{5,}$/.test(channel) && !/^-100\d{6,}$/.test(channel)) return json({ ok: false, error: "Канал укажите как @username или числовой ID -100…" }, 400);
  const values = { store_name: clean(incoming.store_name, 80) || "Мой магазин", legal_footer: clean(incoming.legal_footer, 100), address: clean(incoming.address, 160), website: normalizeUrl(incoming.website), telegram_contact: normalizeTelegram(incoming.telegram_contact), channel_id: channel };
  await writeProfile(env, context.auth.user.id, values);
  return json({ ok: true, profile: await ensureProfile(env, context.auth.user.id) });
}

async function activateClient(request, env) {
  const context = await authenticatedBody(request, env); if (context.response) return context.response; if (!context.profile.is_admin) return json({ ok: false, error: "Только владелец сервиса может активировать клиентов." }, 403); if (!env.PROFILES) return json({ ok: false, error: "Хранилище профилей ещё не подключено." }, 503);
  const clientId = clean(context.body.clientUserId, 30); const days = Math.max(1, Math.min(366, Number(context.body.days) || 30)); const storeName = clean(context.body.storeName, 80) || "Мой магазин";
  if (!/^\d{4,20}$/.test(clientId)) return json({ ok: false, error: "Введите корректный Telegram ID клиента." }, 400); const until = new Date(Date.now() + days * 86400000).toISOString();
  const existing = await readProfile(env, clientId); const preservedName = existing?.store_name && existing.store_name !== "Мой магазин" ? existing.store_name : storeName;
  await writeProfile(env, clientId, { telegram_user_id: clientId, store_name: preservedName, active: 1, subscription_until: until, created_at: existing?.created_at || new Date().toISOString() });
  return json({ ok: true, clientUserId: clientId, subscription_until: until });
}

async function publishToTelegram(request, env) {
  const context = await authenticatedBody(request, env, true); if (context.response) return context.response; const channelId = context.profile.channel_id;
  if (!channelId) return json({ ok: false, error: "Сначала укажите Telegram-канал в настройках магазина." }, 400);
  const caption = buildTelegramCaption(context.body.product, context.profile); const imageDataUrls = Array.isArray(context.body.imageDataUrls) ? context.body.imageDataUrls.slice(0, 3) : [context.body.imageDataUrl]; const images = imageDataUrls.map(dataUrlToBlob).filter(Boolean);
  if (images.length > 1) { const form = new FormData(); form.set("chat_id", channelId); form.set("media", JSON.stringify(images.map((_, index) => ({ type: "photo", media: `attach://photo${index}`, ...(index === 0 ? { caption } : {}) })))); images.forEach((image, index) => form.set(`photo${index}`, image, `product-${index + 1}.jpg`)); await telegram(env, "sendMediaGroup", form); }
  else if (images.length === 1) { const form = new FormData(); form.set("chat_id", channelId); form.set("caption", caption); form.set("photo", images[0], "product.jpg"); await telegram(env, "sendPhoto", form); }
  else return json({ ok: false, error: "Добавьте хотя бы одно фото товара." }, 400);
  return json({ ok: true });
}

async function sendFileToUser(request, env) {
  const context = await authenticatedBody(request, env, true); if (context.response) return context.response; const image = dataUrlToBlob(context.body.imageDataUrl); if (!image) return json({ ok: false, error: "Не удалось подготовить изображение." }, 400);
  const fileName = image.type === "image/png" ? "price-tag.png" : "product-card.jpg"; const form = new FormData(); form.set("chat_id", String(context.auth.user.id)); form.set("caption", `${context.profile.store_name || "Магазин"} · готовый файл`); form.set("document", image, fileName);
  try { await telegram(env, "sendDocument", form); return json({ ok: true }); } catch (error) { return json({ ok: false, error: `Telegram: ${clean(error?.message, 220) || "не удалось отправить файл"}` }, 502); }
}

export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org" } });
  if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "amarket-product-bot", profiles: Boolean(env.PROFILES) });
  if (request.method === "POST" && url.pathname === "/telegram/webhook") return handleWebhook(request, env);
  if (request.method === "POST" && url.pathname === "/api/profile/get") return getProfile(request, env);
  if (request.method === "POST" && url.pathname === "/api/profile/save") return saveProfile(request, env);
  if (request.method === "POST" && url.pathname === "/api/admin/activate") return activateClient(request, env);
  if (request.method === "POST" && url.pathname === "/api/publish/telegram") return publishToTelegram(request, env);
  if (request.method === "POST" && url.pathname === "/api/send/file") return sendFileToUser(request, env);
  return new Response("Not found", { status: 404 });
} };

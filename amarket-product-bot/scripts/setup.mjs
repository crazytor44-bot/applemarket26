const token = process.env.TELEGRAM_BOT_TOKEN;
const workerUrl = String(process.env.WORKER_URL || "").replace(/\/$/, "");
const secret = process.env.WEBHOOK_SECRET;
if (!token || !workerUrl || !secret) {
  console.error("Нужны TELEGRAM_BOT_TOKEN, WORKER_URL и WEBHOOK_SECRET.");
  process.exit(1);
}
async function call(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || method);
  return result.result;
}
await call("setWebhook", { url: `${workerUrl}/telegram/webhook`, secret_token: secret, allowed_updates: ["message"] });
await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Добавить товар", web_app: { url: `${workerUrl}/app` } } });
await call("setMyCommands", { commands: [{ command: "start", description: "Открыть добавление товара" }] });
console.log("Webhook, меню и команда /start настроены.");

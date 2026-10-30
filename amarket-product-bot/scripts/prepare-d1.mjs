import { readFile, writeFile } from "node:fs/promises";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseName = "amarket-product-bot-profiles";

if (!accountId || !apiToken) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`;
const headers = { authorization: `Bearer ${apiToken}`, "content-type": "application/json" };

async function cloudflare(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const message = body.errors?.map((error) => error.message).filter(Boolean).join("; ") || `Cloudflare API ${response.status}`;
    throw new Error(message);
  }
  return body.result;
}

const listed = await cloudflare(`${endpoint}?name=${encodeURIComponent(databaseName)}`);
let database = Array.isArray(listed) ? listed.find((item) => item.name === databaseName) : null;
if (!database) database = await cloudflare(endpoint, { method: "POST", body: JSON.stringify({ name: databaseName }) });

const databaseId = database.uuid || database.id;
if (!databaseId) throw new Error("Cloudflare did not return a D1 database ID");

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
config.d1_databases = [{ binding: "DB", database_name: databaseName, database_id: databaseId, migrations_dir: "migrations" }];
await writeFile(new URL("../wrangler.deploy.jsonc", import.meta.url), `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared D1 binding for ${databaseName}`);

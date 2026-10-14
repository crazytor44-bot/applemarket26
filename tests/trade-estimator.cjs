const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const engine = require("../assets/trade-estimator-core.js");
const choices = {
  model: "iPhone 15 Pro", memory: "256", intent: "Выкуп",
  condition: "minor", battery: "90+", working: "fine",
  repair: "no", account: "clear"
};
assert(engine.models.some(x => x.model === "iPhone 17 Pro Max" && x.storage.includes(2048)));
assert.deepEqual(engine.models.filter(x => x.model === "iPhone 15 Pro").map(x => x.storage), [[128, 256, 512, 1024]]);
assert.equal(engine.storageLabel(128), "128 ГБ");
assert.equal(engine.storageLabel(1024), "1 ТБ");
assert.equal(engine.storageLabel(2048), "2 ТБ");
assert.equal(engine.evaluate(choices, {}).range, null, "Never invent an offer without owner-approved prices");
assert.equal(engine.evaluate(choices, {}).ready, true);
assert.equal(engine.evaluate({...choices, model: "iPhone 0"}, {}).ready, false);
assert.equal(engine.evaluate({...choices, memory: "123"}, {}).ready, false);
assert.equal(engine.evaluate({...choices, working: ""}, {}).ready, false);
assert.equal(engine.evaluate({...choices, intent: ""}, {}).ready, false);
const config = JSON.parse(read("assets/trade-estimates.json"));
assert.equal(config.schemaVersion, 1);
const approved = {
  "iPhone 13|128": 20000,
  "iPhone 14 Pro|256": 30000,
  "iPhone 15 Pro|256": 45000,
  "iPhone 16 Pro|256": 55000,
  "iPhone 17 Pro|256": 75000
};
assert.equal(Object.keys(config.bases).length, 5, "Only five owner-confirmed prices");
for (const [key, price] of Object.entries(approved)) {
 const [model, memory] = key.split("|");
 assert.deepEqual(config.bases[key], { low: price, high: price });
 const quote = engine.evaluate({...choices, model, memory}, config.bases);
 assert(quote.ready && !quote.manual);
 assert.deepEqual(quote.range, {low: price, high: price, text:"≈ " + engine.money(price)}, "Show exact approved indicative price");
 assert.deepEqual(engine.evaluate({...choices, model, memory, condition:"excellent"}, config.bases).range, quote.range,
   "Excellent condition cannot exceed owner-approved buyback price");
}
const key = "iPhone 15 Pro|256";
const base = config.bases;
for(const change of [
  {account:"locked"}, {account:"unknown"}, {condition:"broken"}, {condition:"visible"},
  {working:"issues"}, {working:"dead"}, {battery:"80-89"}, {battery:"70-79"},
  {battery:"below70"}, {battery:"unknown"}, {repair:"yes"}, {repair:"unknown"}
]){
 const result = engine.evaluate({...choices, ...change}, base);
 assert(result.ready && result.manual && !result.range, "Must require manual assessment for unapproved conditions: " + JSON.stringify(change));
}
assert.equal(engine.evaluate({...choices, model:"iPhone 15 Pro", memory:"128"}, base).range, null,
  "Do not offer a price for an unapproved model/memory variant");
assert.equal(engine.evaluate(choices, {[key]:{low:0,high:990000}}).range, null);
assert.equal(engine.evaluate(choices, {[key]:{low:45000,high:30000}}).range, null);
assert.equal(engine.evaluate(choices, {[key]:{low:"30000",high:40000}}).range, null);
const html = read("trade-in/index.html");
for(const phrase of ['id="am-trade-estimator"', 'id="am-est-model"', 'id="am-est-memory"',
                     'id="am-est-result-details"', 'id="am-est-continue"', 'id="trade-form"',
                     'id="am-est-prefilled"', 'href="#request"']){
 assert(html.includes(phrase), "Missing trade-in integration: " + phrase);
}
const form = read("assets/trade-request.js");
assert(form.includes("https://wa.me/79383119888"), "Existing WhatsApp lead form must remain");
const ui = read("assets/trade-estimator.js");
assert(ui.includes("trade-form") && ui.includes('scrollIntoView'));
assert(!ui.includes('method: "POST"') && !ui.includes("localStorage"), "Calculator must not save customer data");
console.log("PASS: iPhone valuation states, safety, baseline prices and existing lead form");

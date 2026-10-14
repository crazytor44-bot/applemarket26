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
const key = "iPhone 15 Pro|256";
const base = {[key]: {low: 30000, high: 40000}};
assert.deepEqual(engine.evaluate(choices, base).range, {low:30000, high:40000, text:engine.money(30000) + " — " + engine.money(40000)});
const worn = engine.evaluate({...choices, condition:"visible", battery:"70-79", repair:"yes"}, base);
assert(worn.range.high < 40000 && worn.range.low < 30000, "Condition lowers approved indicative offer");
for(const change of [
  {account:"locked"}, {account:"unknown"}, {condition:"broken"},
  {working:"issues"}, {working:"dead"}
]){
 const result = engine.evaluate({...choices, ...change}, base);
 assert(result.ready && result.manual && !result.range, "Must require manual inspection for risky states");
}
assert.equal(engine.evaluate(choices, {[key]:{low:0,high:990000}}).range, null);
assert.equal(engine.evaluate(choices, {[key]:{low:45000,high:30000}}).range, null);
assert.equal(engine.evaluate(choices, {[key]:{low:"30000",high:40000}}).range, null);
const config = JSON.parse(read("assets/trade-estimates.json"));
assert.equal(config.schemaVersion, 1);
assert.deepEqual(config.bases, {}, "No unapproved buyback quotes in production");
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

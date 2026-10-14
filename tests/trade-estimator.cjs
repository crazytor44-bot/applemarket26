const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const engine = require("../assets/trade-estimator-core.js");
const config = JSON.parse(read("assets/trade-estimates.json"));
const choices = {
  model: "iPhone 15 Pro", memory: "256", intent: "Выкуп",
  condition: "minor", battery: "90+", working: "fine",
  repair: "no", account: "clear"
};
const quote = (values = {}, settings = config) => engine.evaluate({...choices, ...values}, settings);
const approved = {
  "iPhone 13|128": 20000, "iPhone 14 Pro|256": 30000,
  "iPhone 15 Pro|256": 45000, "iPhone 16 Pro|256": 55000,
  "iPhone 17 Pro|256": 75000
};

assert.equal(config.schemaVersion, 2);
assert.deepEqual(config.approvedBases, approved, "Retain only the five merchant-confirmed prices");
assert(engine.models.some(x => x.model === "iPhone 17 Pro Max" && x.storage.includes(2048)));
assert.deepEqual(engine.models.filter(x => x.model === "iPhone 15 Pro").map(x => x.storage), [[128, 256, 512, 1024]]);
assert.equal(engine.storageLabel(128), "128 ГБ");
assert.equal(engine.storageLabel(1024), "1 ТБ");
assert.equal(engine.storageLabel(2048), "2 ТБ");
assert.deepEqual(engine.modelInfo("iPhone Air"), {generation:17,tier:"air"});
assert.deepEqual(engine.modelInfo("iPhone 16e"), {generation:16,tier:"e"});
assert.equal(engine.modelInfo("iPhone FAKE"), null);

for (const [key, value] of Object.entries(approved)) {
  const [model, memory] = key.split("|");
  const result = quote({model, memory});
  assert.equal(result.source, "approved");
  assert.equal(result.range.low, value, "Approved base price must be unchanged: " + key);
  assert.equal(result.range.high, value);
  assert.equal(result.range.text, "≈ " + engine.money(value));
  assert.equal(result.discountAmount, 0);
  assert.equal(quote({model, memory, condition:"excellent"}).range.low, value,
    "Excellent condition must not exceed approved price");
}
let total = 0;
for (const item of engine.models) {
  let last = -1;
  for (const storage of item.storage) {
    const result = quote({model:item.model, memory:String(storage)});
    assert(result.ready && !result.manual, item.model + " " + storage);
    assert(result.range?.low > 0, "No unsupported model/memory: " + item.model + " " + storage);
    assert.equal(result.range.low % 500, 0, "Round to 500 RUB");
    assert(result.range.low >= last, "More storage must not reduce the quote: " + item.model);
    last = result.range.low;
    total++;
  }
}
assert(total >= 100, "Cover the full selectable iPhone catalog");

const v = quote();
assert.equal(v.range.low, 45000);
assert(quote({condition:"visible"}).range.low < v.range.low);
assert(quote({battery:"80-89"}).range.low < v.range.low);
assert(quote({battery:"70-79"}).range.low < quote({battery:"80-89"}).range.low);
assert(quote({battery:"below70"}).range.low < quote({battery:"70-79"}).range.low);
assert(quote({repair:"yes"}).range.low < v.range.low);
assert(quote({condition:"visible",battery:"80-89",repair:"yes"}).range.low <
       quote({condition:"visible",battery:"80-89"}).range.low);
assert.equal(quote({model:"iPhone 15 Pro",memory:"128"}).source,"calculated");
assert.equal(quote({model:"iPhone 15 Pro",memory:"128"}).range.low, 42000);

for (const change of [
  {account:"locked"}, {account:"unknown"}, {condition:"broken"},
  {working:"issues"}, {working:"dead"}, {battery:"unknown"}, {repair:"unknown"}
]) {
  const result = quote(change);
  assert(result.ready && result.manual && !result.range,
    "Never quote devices requiring inspection: " + JSON.stringify(change));
}
for (const change of [
  {model:"iPhone 0"}, {memory:"123"}, {working:""}, {intent:""}, {battery:""}
]) assert.equal(quote(change).ready, false, "Reject incomplete/invalid selections");

const brokenSettings = {...config, derivedReference256:{...config.derivedReference256,pro:{}}};
assert.equal(quote({model:"iPhone 18 Pro"},brokenSettings).range,null);
assert.equal(quote({},null).range,null);
const emptyApproved = {...config,approvedBases:{}};
assert.equal(quote({},emptyApproved).source,"calculated",
  "Calculations are possible without an anchor entry, but must still be model-based");

const html = read("trade-in/index.html");
for (const phrase of [
  'id="am-trade-estimator"', 'id="am-est-model"', 'id="am-est-memory"',
  'id="am-est-result-details"', 'id="am-est-continue"',
  'id="am-est-reset"', 'id="trade-form"', 'id="am-est-prefilled"',
  'href="#request"'
]) assert(html.includes(phrase), "Missing Trade-in integration: " + phrase);
assert(html.includes("без регистрации") || html.includes("Без регистрации"));
const form = read("assets/trade-request.js");
assert(form.includes("https://wa.me/79383119888"),
  "The original optional WhatsApp form must remain");
const ui = read("assets/trade-estimator.js");
assert(ui.includes("quote.range.text") && ui.includes('out.reset.addEventListener'));
assert(ui.includes('out.cta.addEventListener') && ui.includes('scrollIntoView'));
assert(!ui.includes('method: "POST"') && !ui.includes("localStorage"),
  "Appraisal does not store customer data");
console.log("PASS: " + total + " model/storage combinations, 5 anchors, adjustment rules, "
  + "manual review exceptions, optional WhatsApp form");

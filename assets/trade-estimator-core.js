/* А Маркет: preliminary buyback estimates anchored to owner-approved prices and
   documented model/storage, battery, repair and appearance adjustments. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AMarketTradeEstimator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const groups = [
    ["iPhone 11", [64, 128, 256]],
    ["iPhone 11 Pro", [64, 256, 512]],
    ["iPhone 11 Pro Max", [64, 256, 512]],
    ["iPhone 12 mini", [64, 128, 256]],
    ["iPhone 12", [64, 128, 256]],
    ["iPhone 12 Pro", [128, 256, 512]],
    ["iPhone 12 Pro Max", [128, 256, 512]],
    ["iPhone 13 mini", [128, 256, 512]],
    ["iPhone 13", [128, 256, 512]],
    ["iPhone 13 Pro", [128, 256, 512, 1024]],
    ["iPhone 13 Pro Max", [128, 256, 512, 1024]],
    ["iPhone 14", [128, 256, 512]],
    ["iPhone 14 Plus", [128, 256, 512]],
    ["iPhone 14 Pro", [128, 256, 512, 1024]],
    ["iPhone 14 Pro Max", [128, 256, 512, 1024]],
    ["iPhone 15", [128, 256, 512]],
    ["iPhone 15 Plus", [128, 256, 512]],
    ["iPhone 15 Pro", [128, 256, 512, 1024]],
    ["iPhone 15 Pro Max", [256, 512, 1024]],
    ["iPhone 16e", [128, 256, 512]],
    ["iPhone 16", [128, 256, 512]],
    ["iPhone 16 Plus", [128, 256, 512]],
    ["iPhone 16 Pro", [128, 256, 512, 1024]],
    ["iPhone 16 Pro Max", [256, 512, 1024]],
    ["iPhone 17e", [256, 512]],
    ["iPhone 17", [256, 512]],
    ["iPhone Air", [256, 512, 1024]],
    ["iPhone 17 Pro", [256, 512, 1024]],
    ["iPhone 17 Pro Max", [256, 512, 1024, 2048]],
    ["iPhone 18 Pro", [256, 512, 1024]],
    ["iPhone 18 Pro Max", [256, 512, 1024, 2048]]
  ];
  const models = Object.freeze(groups.map(([model, storage]) =>
    Object.freeze({ model, storage: Object.freeze(storage) })));
  const money = amount => new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
  const storageLabel = value => value >= 1024 ? value / 1024 + " ТБ" : value + " ГБ";
  const validChoices = {
    condition: ["excellent", "minor", "visible", "broken"],
    battery: ["90+", "80-89", "70-79", "below70", "unknown"],
    working: ["fine", "issues", "dead"],
    repair: ["no", "yes", "unknown"],
    account: ["clear", "locked", "unknown"],
    intent: ["Выкуп", "Обмен"]
  };
  const round500 = n => Math.round(n / 500) * 500;
  const floor500 = n => Math.floor(n / 500 + 1e-9) * 500;
  const allowedMoney = n => Number.isSafeInteger(n) && n >= 1000 && n <= 300000;

  function modelInfo(model) {
    if (model === "iPhone Air") return { generation: 17, tier: "air" };
    const m = /^iPhone (\d{2})(.*)$/.exec(model);
    if (!m) return null;
    const generation = Number(m[1]);
    const suffix = m[2].trim();
    const tiers = {"": "base", "mini": "mini", "Plus": "plus",
      "Pro": "pro", "Pro Max": "promax", "e": "e"};
    const tier = tiers[suffix];
    return tier ? { generation, tier } : null;
  }
  function calculateReferencePrice(model, memory, config) {
    const info = modelInfo(model);
    if (!info || !config || config.schemaVersion !== 2) return null;
    const g = String(info.generation);
    const isPro = info.tier === "pro" || info.tier === "promax";
    const table = isPro ? config.derivedReference256?.pro : config.derivedReference256?.base;
    let price = table?.[g];
    if (!allowedMoney(price)) return null;

    const modifiers = config.tierAdjustments || {};
    const modifier = info.tier === "promax" ? modifiers.promax?.[g] :
      info.tier === "plus" ? modifiers.plus :
      info.tier === "mini" ? modifiers.mini :
      info.tier === "e" ? modifiers.e?.[g] :
      info.tier === "air" ? modifiers.air : 0;
    if (!Number.isFinite(modifier) || Math.abs(modifier) > 40000) return null;
    price += modifier;

    const points = config.memoryPoints || {};
    const factor = config.memoryFactors?.[g];
    if (!Number.isFinite(points[memory]) || !Number.isFinite(points["256"]) ||
        !Number.isFinite(factor) || factor < 0 || factor > 1) return null;
    price += (points[memory] - points["256"]) * factor;
    const result = round500(price);
    return allowedMoney(result) ? result : null;
  }
  function evaluate(input, config) {
    const item = models.find(m => m.model === input?.model);
    const memory = Number(input?.memory);
    if (!item || !item.storage.includes(memory)) {
      return { ready: false, message: "Выберите модель iPhone и память." };
    }
    for (const [field, allowed] of Object.entries(validChoices)) {
      if (!allowed.includes(input?.[field])) {
        return { ready: false, message: "Заполните все параметры телефона." };
      }
    }
    const reasons = [];
    if (input.account !== "clear") reasons.push("Блокировку Apple ID и «Локатора» нужно проверить лично.");
    if (input.condition === "broken") reasons.push("Повреждения и трещины требуют индивидуальной диагностики.");
    if (input.working !== "fine") reasons.push("Неисправности требуют диагностики.");
    if (input.battery === "unknown") reasons.push("Необходимо уточнить состояние аккумулятора.");
    if (input.repair === "unknown") reasons.push("Необходимо уточнить историю ремонтов.");

    const key = input.model + "|" + memory;
    const ownerApproved = config?.schemaVersion === 2 ? config.approvedBases?.[key] : null;
    const confirmed = allowedMoney(ownerApproved);
    const base = confirmed ? ownerApproved : calculateReferencePrice(input.model, memory, config);
    const noPrices = !allowedMoney(base);
    // Prices approved by the owner are for "like new" appearance.
    // Light wear is ALWAYS 2,500 ₽ lower, without raising the maximum buyback offer.
    const factors = [
      config?.batteryFactors?.[input.battery],
      config?.repairFactors?.[input.repair]
    ];
    if (factors.some(n => !Number.isFinite(n) || n <= 0 || n > 1)) {
      reasons.push("Для выбранного состояния нужна индивидуальная оценка.");
    }
    const appearance = config?.appearanceDeductions?.[input.condition];
    const validAppearance = Number.isSafeInteger(appearance) &&
      appearance >= 0 && appearance <= 40000 && appearance % 500 === 0;
    if (input.condition !== "broken" && !validAppearance) {
      reasons.push("Для внешнего состояния необходима индивидуальная оценка.");
    }
    const manual = reasons.length > 0;
    let range = null;
    let price = null;
    if (!manual && !noPrices) {
      // Keep more visible damage below light wear, including inexpensive old phones.
      const visibleFraction = config?.visibleWearExtraFraction;
      const visualDeduction = input.condition === "visible"
        ? Math.max(appearance, Number.isFinite(visibleFraction) && visibleFraction >= 0 && visibleFraction <= 0.5
          ? Math.ceil(base * visibleFraction / 500) * 500 : appearance)
        : appearance;
      // Round DOWN before subtracting the fixed cosmetic discount.
      price = floor500(base * factors.reduce((a, b) => a * b, 1)) - visualDeduction;
      if (price >= 1000 && price <= base) {
        range = { low: price, high: price, text: "≈ " + money(price) };
      } else {
        price = null;
      }
    }
    const grade = manual ? "Нужна индивидуальная оценка" :
      input.condition === "excellent" ? "Отличное состояние" : "Предварительная оценка";
    return {
      ready: true, model: input.model, memory, grade, range,
      basePrice: noPrices ? null : base,
      price, source: confirmed ? "approved" : noPrices ? "none" : "calculated",
      manual, reasons, noPrices,
      discountAmount: price === null || noPrices ? null : base - price
    };
  }
  return { models, money, storageLabel, evaluate, modelInfo, calculateReferencePrice };
});

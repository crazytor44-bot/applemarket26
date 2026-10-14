/* А Маркет: pure calculations for preliminary iPhone buyback estimates.
   Price ranges are NEVER guessed: they only come from merchant-approved bases. */
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

  function evaluate(input, configuredPrices) {
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
    // The owner approved prices only for sound devices with battery 90%+,
    // no repairs and no activation locks. Never invent depreciation coefficients.
    const manualReasons = [];
    if (input.account !== "clear") manualReasons.push("Нужно проверить, сняты ли блокировки Apple ID и «Локатора».");
    if (input.condition === "broken") manualReasons.push("Трещины и повреждения требуют осмотра.");
    else if (input.condition === "visible") manualReasons.push("При заметных царапинах или сколах стоимость уточняется после осмотра.");
    if (input.working !== "fine") manualReasons.push("Неисправности требуют диагностики.");
    if (input.battery !== "90+") manualReasons.push("Для этого состояния аккумулятора стоимость уточняется индивидуально.");
    if (input.repair !== "no") manualReasons.push("После ремонта или при неизвестной истории нужна дополнительная проверка.");
    const grade = manualReasons.length
      ? "Нужна индивидуальная оценка"
      : input.condition === "excellent" ? "Отличное состояние" : "Хорошее состояние";
    const itemKey = input.model + "|" + memory;
    const base = configuredPrices && typeof configuredPrices === "object" ? configuredPrices[itemKey] : undefined;
    const baseValid = base && Number.isSafeInteger(base.low) && Number.isSafeInteger(base.high) &&
      base.low >= 1000 && base.high >= base.low && base.high <= 1000000;
    let range = null;
    if (baseValid && !manualReasons.length) {
      const low = base.low;
      const high = base.high;
      range = { low, high, text: low === high ? "≈ " + money(low) : money(low) + " — " + money(high) };
    }
    return {
      ready: true, model: input.model, memory, grade, range, manual: manualReasons.length > 0,
      reasons: manualReasons, noPrices: !baseValid
    };
  }
  return { models, money, storageLabel, evaluate };
});

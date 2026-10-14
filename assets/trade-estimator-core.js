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
  const roundDown = n => Math.floor(n / 500) * 500;
  const roundUp = n => Math.ceil(n / 500) * 500;
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
    const manualReasons = [];
    if (input.account !== "clear") manualReasons.push("Нужно проверить, снята ли блокировка Apple ID и «Локатора».");
    if (input.condition === "broken") manualReasons.push("Повреждения экрана или корпуса оцениваются индивидуально.");
    if (input.working !== "fine") manualReasons.push("Неисправности требуют диагностики перед оценкой.");

    const conditionFactor = { excellent: 1.04, minor: 1, visible: 0.9, broken: 0.7 };
    const batteryFactor = { "90+": 1, "80-89": 0.95, "70-79": 0.86, below70: 0.76, unknown: 0.89 };
    const repairFactor = { no: 1, yes: 0.9, unknown: 0.92 };
    const factor = conditionFactor[input.condition] * batteryFactor[input.battery] * repairFactor[input.repair];
    const grade = manualReasons.length
      ? "Требуется проверка"
      : factor >= 0.98 ? "Отличное состояние"
      : factor >= 0.84 ? "Хорошее состояние" : "Нужна дополнительная оценка";
    const itemKey = input.model + "|" + memory;
    const base = configuredPrices && typeof configuredPrices === "object" ? configuredPrices[itemKey] : undefined;
    const baseValid = base && Number.isSafeInteger(base.low) && Number.isSafeInteger(base.high) &&
      base.low >= 1000 && base.high >= base.low && base.high <= 1000000;
    let range = null;
    if (baseValid && !manualReasons.length) {
      const low = roundDown(base.low * factor);
      const high = Math.max(low, roundUp(base.high * factor));
      if (low > 0) range = { low, high, text: money(low) + " — " + money(high) };
    }
    return {
      ready: true, model: input.model, memory, grade, range, manual: manualReasons.length > 0,
      reasons: manualReasons, factor: Math.round(factor * 100) / 100,
      noPrices: !baseValid
    };
  }
  return { models, money, storageLabel, evaluate };
});

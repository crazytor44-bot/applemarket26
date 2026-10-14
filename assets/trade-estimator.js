/* А Маркет — быстрый калькулятор Trade-in. Не отправляет данные на сервер. */
(() => {
  "use strict";
  const root = document.getElementById("am-trade-estimator");
  const engine = window.AMarketTradeEstimator;
  if (!root || !engine) return;

  const $ = id => document.getElementById(id);
  const fields = {
    model: $("am-est-model"), memory: $("am-est-memory"),
    condition: $("am-est-condition"), battery: $("am-est-battery"),
    working: $("am-est-working"), repair: $("am-est-repair"),
    account: $("am-est-account"), intent: $("am-est-intent")
  };
  const out = {
    heading: $("am-est-result-title"), amount: $("am-est-amount"),
    details: $("am-est-result-details"), warning: $("am-est-warning"),
    cta: $("am-est-continue"), reset: $("am-est-reset"), badge: $("am-est-badge")
  };
  let valuationConfig = null;

  function fillOptions(select, values, placeholder, toLabel) {
    select.replaceChildren(new Option(placeholder, ""));
    for (const value of values) {
      select.add(new Option(toLabel ? toLabel(value) : String(value), String(value)));
    }
  }
  function values() {
    return Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value]));
  }
  function updateMemory() {
    const item = engine.models.find(p => p.model === fields.model.value);
    const prev = fields.memory.value;
    fillOptions(fields.memory, item ? item.storage : [], "Выберите память", engine.storageLabel);
    if (item && item.storage.includes(Number(prev))) fields.memory.value = prev;
    fields.memory.disabled = !item;
  }
  function update() {
    const quote = engine.evaluate(values(), valuationConfig);
    out.cta.disabled = !quote.ready;
    out.reset.hidden = !quote.ready;
    out.warning.hidden = true;
    if (!quote.ready) {
      out.heading.textContent = "Ваш iPhone — наша оценка";
      out.amount.textContent = "Укажите параметры";
      out.details.textContent = "Мы подготовим заявку на выкуп или обмен без звонков и регистрации.";
      out.badge.textContent = "БЫСТРАЯ ОЦЕНКА";
      out.cta.textContent = "Запросить оценку →";
      return;
    }
    out.heading.textContent = quote.grade;
    out.badge.textContent = quote.range ? "ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ" : "ИНДИВИДУАЛЬНАЯ ОЦЕНКА";
    out.cta.textContent = quote.range ?
      (fields.intent.value === "Обмен" ? "Хочу обменять iPhone →" : "Хочу продать iPhone →") :
      "Запросить индивидуальную оценку →";
    if (quote.manual) {
      out.amount.textContent = "Нужна проверка устройства";
      out.details.textContent = quote.reasons.join(" ") + " Заполненные данные перенесём в заявку.";
      out.warning.hidden = false;
      out.warning.textContent = "Для неисправных устройств и телефонов с блокировками автоматическую цену не показываем.";
    } else if (quote.range) {
      out.amount.textContent = quote.range.text;
      out.details.textContent = (quote.source === "approved" ?
        "Ориентир на основе цены магазина." :
        "Автоматический ориентир по модели и памяти, рассчитанный на основе цен магазина.") +
        (quote.discountAmount > 0 ? " Учтено снижение на " + engine.money(quote.discountAmount) + " за состояние, АКБ и ремонт." : "") +
        " WhatsApp для просмотра цены не нужен. Итог после осмотра.";
    } else {
      out.amount.textContent = "Сумма после проверки";
      out.details.textContent = "Сейчас не получается рассчитать стоимость автоматически. Можно запросить индивидуальную оценку.";
    }
  }

  fillOptions(fields.model, engine.models.map(x => x.model), "Выберите модель");
  updateMemory();
  fields.model.addEventListener("change", () => { updateMemory(); update(); });
  for (const [key, select] of Object.entries(fields)) {
    if (key !== "model") select.addEventListener("change", update);
  }

  const conditionMap = {
    excellent: "Без заметных следов использования",
    minor: "Есть небольшие царапины",
    visible: "Есть сколы или сильные царапины",
    broken: "Есть трещины / разбит экран или корпус"
  };
  const workingMap = { fine: "Всё работает", issues: "Есть неисправности", dead: "Не включается" };
  const repairMap = { no: "Не ремонтировался", yes: "Ремонтировался — опишу ниже", unknown: "Не знаю" };
  const batteryMap = { "90+": "90% и выше", "80-89": "80–89%", "70-79": "70–79%", below70: "ниже 70%", unknown: "не знаю" };
  const accountMap = { clear: "Apple ID и «Локатор» отвязаны", locked: "Есть блокировка", unknown: "Требует проверки" };

  out.reset.addEventListener("click", () => {
    for (const [key, field] of Object.entries(fields)) if (key !== "intent") field.value = "";
    updateMemory();
    const note = $("am-est-prefilled");
    if (note) note.hidden = true;
    update();
    fields.model.focus();
  });

  out.cta.addEventListener("click", () => {
    const input = values();
    const quote = engine.evaluate(input, approvedBases);
    if (!quote.ready) return;
    const form = document.getElementById("trade-form");
    if (!form) return;
    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    };
    set("intent", input.intent);
    form.elements.namedItem("intent")?.dispatchEvent(new Event("change", { bubbles: true }));
    set("model", input.model);
    // Reset custom validation error, if the customer previously submitted the form empty.
    form.elements.namedItem("model")?.dispatchEvent(new Event("input", { bubbles: true }));
    set("memory", engine.storageLabel(Number(input.memory)));
    set("condition", conditionMap[input.condition]);
    set("working", workingMap[input.working]);
    set("repair", repairMap[input.repair]);
    // Don't invent an exact battery percentage when the client gave a range.
    set("battery", "");
    const details = form.elements.namedItem("details");
    if (details) {
      const current = details.value.replace(/\n?\[Данные быстрой оценки\][\s\S]*?\[Конец оценки\]\n?/g, "").trim();
      const estimatorNotes = [
        "[Данные быстрой оценки]",
        "АКБ: " + batteryMap[input.battery],
        "Apple ID / Локатор: " + accountMap[input.account],
        "Результат: " + (quote.range ? quote.range.text + " (предварительно)" : quote.grade + " — сумма после проверки"),
        "[Конец оценки]"
      ].join("\n");
      details.value = [current, estimatorNotes].filter(Boolean).join("\n\n");
    }
    document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const note = document.getElementById("am-est-prefilled");
    if (note) { note.hidden = false; note.textContent = "Готово! Мы заполнили заявку. Проверьте информацию и нажмите кнопку WhatsApp, чтобы отправить её в магазин."; }
  });

  fetch("/assets/trade-estimates.json", { cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (config && config.schemaVersion === 2 && config.approvedBases && config.derivedReference256) {
        valuationConfig = config;
      }
      update();
    })
    .catch(update);
  update();
})();

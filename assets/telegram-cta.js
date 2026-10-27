/* Track Telegram channel CTA clicks without delaying outbound navigation. */
(() => {
  "use strict";
  document.addEventListener("click", event => {
    const element = event.target instanceof Element ? event.target : event.target?.parentElement;
    const link = element?.closest?.("a[data-telegram-subscribe]");
    if (!link || typeof window.ym !== "function") return;
    try {
      window.ym(109374177, "reachGoal", "telegram_channel_click", {
        placement: link.getAttribute("data-telegram-subscribe") || "unknown"
      });
    } catch (_) { /* Tracking must never interfere with navigation. */ }
  });
})();

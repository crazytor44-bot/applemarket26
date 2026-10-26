const $ = (id) => document.getElementById(id);
const fields = ["model","storage","color","price","battery","sim","condition","warranty","notes","productUrl"];
let mainPhoto = null;

const clean = (value) => String(value || "").trim();
const formatPrice = (value) => {
  const number = Number(String(value).replace(/\D/g, ""));
  return number ? `${new Intl.NumberFormat("ru-RU").format(number)} ₽` : "Цена по запросу";
};

function productFromForm() {
  return Object.fromEntries(fields.map((id) => [id, clean($(id).value)]));
}

function saveDraft() {
  localStorage.setItem("am-one-product-draft", JSON.stringify(productFromForm()));
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem("am-one-product-draft") || "{}");
    fields.forEach((id) => { if (draft[id] !== undefined) $(id).value = draft[id]; });
  } catch (_) {}
}

function detailsLine(p) {
  return [p.storage, p.color, p.battery && `АКБ ${p.battery}`, p.sim].filter(Boolean).join(" · ");
}

function makeTelegram(p) {
  const details = detailsLine(p);
  return [`📱 ${p.model} ${p.storage}`.trim(), "", details, `Состояние: ${p.condition}`, p.warranty && `Гарантия: ${p.warranty}`, p.notes, "", `💳 ${formatPrice(p.price)}`, "", "📍 А Маркет, Ставрополь, Тухачевского, 16", p.productUrl && `Подробнее: ${p.productUrl}`].filter((line) => line !== "" || true).join("\n").replace(/\n{3,}/g,"\n\n").trim();
}

function makeAvito(p) {
  return [`${p.model} ${p.storage} ${p.color}`.replace(/\s+/g," ").trim(), [`Продаётся ${p.model} ${p.storage}.`, "", `Состояние: ${p.condition}.`, p.color && `Цвет: ${p.color}.`, p.battery && `Состояние аккумулятора: ${p.battery}.`, p.sim && `Формат SIM: ${p.sim}.`, p.warranty && `Гарантия: ${p.warranty}.`, p.notes, "", "Телефон можно проверить перед покупкой.", "Обмен по программе Trade-in.", "", "А Маркет", "Ставрополь, Тухачевского, 16"].filter(Boolean).join("\n")];
}

function makeInstagram(p) {
  return [`${p.model} ${p.storage} — в наличии 📱`, "", detailsLine(p), `Состояние: ${p.condition}`, p.warranty && `Гарантия: ${p.warranty}`, p.notes, "", `Цена: ${formatPrice(p.price)}`, "", "📍 Ставрополь, Тухачевского, 16", "Пишите в сообщения или приходите в А Маркет.", "", "#амаркет #ставрополь #iphoneставрополь #телефоныставрополь"].filter((line) => line !== false && line !== undefined).join("\n").replace(/\n{3,}/g,"\n\n").trim();
}

function drawSocialCard(p) {
  const canvas = $("socialCard");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0c0f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const draw = () => {
    if (mainPhoto) {
      const scale = Math.max(canvas.width / mainPhoto.width, 900 / mainPhoto.height);
      const w = mainPhoto.width * scale;
      const h = mainPhoto.height * scale;
      ctx.drawImage(mainPhoto, (canvas.width - w) / 2, 0, w, h);
      const gradient = ctx.createLinearGradient(0, 500, 0, 1120);
      gradient.addColorStop(0, "rgba(11,12,15,0)");
      gradient.addColorStop(.55, "rgba(11,12,15,.82)");
      gradient.addColorStop(1, "#0b0c0f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 450, canvas.width, 750);
    } else {
      ctx.fillStyle = "#17191f";
      ctx.fillRect(54, 54, 972, 790);
      ctx.fillStyle = "#31343d";
      ctx.font = "700 34px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Добавьте фотографию товара", 540, 455);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#fff";
    ctx.font = "800 30px -apple-system, sans-serif";
    ctx.fillText("А МАРКЕТ", 72, 92);
    ctx.font = "900 68px -apple-system, sans-serif";
    wrapText(ctx, p.model, 72, 920, 900, 76, 2);
    ctx.fillStyle = "#b7bac4";
    ctx.font = "650 31px -apple-system, sans-serif";
    ctx.fillText(detailsLine(p), 74, 1088);
    ctx.fillStyle = "#fff";
    ctx.font = "950 76px -apple-system, sans-serif";
    ctx.fillText(formatPrice(p.price), 72, 1195);
    ctx.fillStyle = "#b7bac4";
    ctx.font = "600 26px -apple-system, sans-serif";
    ctx.fillText("Ставрополь · Тухачевского, 16", 74, 1272);
  };
  draw();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = clean(text).split(/\s+/);
  let line = "", lines = [];
  words.forEach((word) => {
    const test = `${line} ${word}`.trim();
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function render(p) {
  const [avitoTitle, avitoText] = makeAvito(p);
  $("telegramText").value = makeTelegram(p);
  $("avitoTitle").value = avitoTitle;
  $("avitoText").value = avitoText;
  $("instagramText").value = makeInstagram(p);
  $("tagModel").textContent = `${p.model} ${p.storage}`.trim();
  $("tagDetails").textContent = [p.color, p.battery && `АКБ ${p.battery}`, p.sim].filter(Boolean).join(" · ");
  $("tagPrice").textContent = formatPrice(p.price);
  $("jsonText").value = JSON.stringify({id:`used-${Date.now()}`,title:`${p.model} ${p.storage}`.trim(),price:Number(p.price.replace(/\D/g,""))||null,condition:p.condition,color:p.color,storage:p.storage,battery:p.battery,sim:p.sim,warranty:p.warranty,notes:p.notes,url:p.productUrl,status:"draft",createdAt:new Date().toISOString()}, null, 2);
  drawSocialCard(p);
  $("emptyState").hidden = true;
  $("resultContent").hidden = false;
  $("formMessage").textContent = "Материалы готовы. Черновик сохранён на этом устройстве.";
  saveDraft();
  if (innerWidth < 900) $("results").scrollIntoView({behavior:"smooth"});
}

$("photos").addEventListener("change", (event) => {
  const files = [...event.target.files].slice(0, 10);
  $("photoPreview").replaceChildren();
  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.alt = `Фото ${index + 1}`;
      if (index === 0) image.onload = () => { mainPhoto = image; };
      image.src = reader.result;
      $("photoPreview").appendChild(image);
    };
    reader.readAsDataURL(file);
  });
});

$("productForm").addEventListener("submit", (event) => { event.preventDefault(); render(productFromForm()); });
document.querySelectorAll(".copy").forEach((button) => button.addEventListener("click", async () => {
  const target = $(button.dataset.target);
  try { await navigator.clipboard.writeText(target.value); button.textContent = "Скопировано"; setTimeout(() => button.textContent = button.dataset.target === "jsonText" ? "Копировать JSON" : "Копировать", 1200); }
  catch (_) { target.select(); document.execCommand("copy"); }
}));
$("downloadCard").addEventListener("click", () => { const a=document.createElement("a"); a.download=`${clean($("model").value).replace(/[^a-zа-я0-9]+/gi,"-").toLowerCase()||"product"}-amarket.png`; a.href=$("socialCard").toDataURL("image/png"); a.click(); });
$("printTag").addEventListener("click", () => window.print());
$("resetButton").addEventListener("click", () => { if (!confirm("Очистить текущий черновик?")) return; localStorage.removeItem("am-one-product-draft"); location.reload(); });
fields.forEach((id) => $(id).addEventListener("input", saveDraft));
restoreDraft();

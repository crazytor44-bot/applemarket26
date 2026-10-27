(()=>{"use strict";
let accessKey="",apiUrl="",allOrders=[];
const el=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat("ru-RU").format(Number(value)||0)+" ₽";
const text=(name,value)=>{const e=document.createElement(name);e.textContent=String(value??"");return e;};
const niceDate=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?String(value||""):new Intl.DateTimeFormat("ru-RU",{dateStyle:"medium",timeStyle:"short"}).format(d);};
function msg(id,message){el(id).textContent=message}
function row(left,right){const line=document.createElement("div");line.className="line";line.append(text("span",left),text("strong",right));return line;}
function render(orders){
  const container=el("orders");container.replaceChildren();
  if(!orders.length){const empty=text("div","Нет заявок по выбранному запросу.");empty.className="empty";container.append(empty);return;}
  for(const order of orders){
    const card=document.createElement("article");card.className="order";
    const head=document.createElement("div");head.className="row";
    const number=text("span","#"+order.id);number.className="order-id";
    const badge=text("span",order.status==="new"?"Новая":order.status||"Заявка");badge.className="badge";head.append(number,badge);card.append(head);
    const name=text("h3",order.name||"Покупатель");name.className="order-name";card.append(name);
    const phone=text("a",order.phone||"Телефон не указан");phone.className="phone";
    const safeNumber=String(order.phone||"").replace(/[^+\d]/g,"");if(safeNumber)phone.setAttribute("href","tel:"+safeNumber);card.append(phone);
    const attrs=[niceDate(order.created_at),order.city,order.contact].filter(Boolean).join(" · ");
    if(attrs){const meta=text("p",attrs);meta.className="order-meta";card.append(meta)}
    for(const item of Array.isArray(order.items)?order.items:[]){
      card.append(row(item.name||"Товар",(Number(item.qty)||0)+" × "+money(item.price)));
    }
    const summary=document.createElement("div");summary.className="sum";summary.append(text("span","Итого"),text("strong",money(order.total)));card.append(summary);
    if(order.comment){const note=text("div",order.comment);note.className="comment";card.append(note);}
    container.append(card);
  }
}
function applySearch(){
  const q=el("search").value.trim().toLocaleLowerCase("ru-RU");
  const filtered=q?allOrders.filter(x=>[x.id,x.name,x.phone,x.city,x.contact,x.comment,...(Array.isArray(x.items)?x.items.map(i=>i.name):[])].join(" ").toLocaleLowerCase("ru-RU").includes(q)):allOrders;
  el("count").textContent="Всего: "+allOrders.length+" · Показано: "+filtered.length;
  render(filtered);
}
async function config(){
  const response=await fetch("/assets/orders-config.json",{cache:"no-store"});
  if(!response.ok)throw new Error("Настройки сервера недоступны");
  const obj=await response.json();
  if(typeof obj.apiUrl!=="string"||!/^https:\/\//.test(obj.apiUrl))throw new Error("Система заказов пока не подключена к Яндекс Cloud.");
  return obj.apiUrl;
}
async function load(){
  msg("dashboard-message","Загружаем заявки…");
  const response=await fetch(apiUrl,{method:"GET",headers:{"Authorization":"Bearer "+accessKey},cache:"no-store"});
  let data={};try{data=await response.json()}catch{}
  if(response.status===401){accessKey="";throw new Error("Неверный ключ доступа. Проверьте его и попробуйте снова.");}
  if(!response.ok||!data.ok||!Array.isArray(data.orders))throw new Error(data.error||"Не удалось загрузить заявки");
  allOrders=data.orders;applySearch();msg("dashboard-message","");
}
async function login(){
  const btn=el("login-btn"),input=el("access-key");
  const key=input.value.trim();
  if(key.length<32){msg("login-message","Укажите индивидуальный ключ доступа (не менее 32 символов).");return;}
  btn.disabled=true;msg("login-message","Проверяем доступ…");
  try{
    apiUrl=await config();accessKey=key;
    await load();
    input.value="";
    el("login").hidden=true;el("dashboard").hidden=false;msg("login-message","");
  }catch(error){accessKey="";msg("login-message",error.message||"Не удалось подключиться.");}
  finally{btn.disabled=false;}
}
function logout(){
  accessKey="";apiUrl="";allOrders=[];el("orders").replaceChildren();el("dashboard").hidden=true;el("login").hidden=false;el("access-key").value="";el("search").value="";msg("login-message","");el("access-key").focus();
}
document.addEventListener("DOMContentLoaded",()=>{
  el("login-btn").addEventListener("click",login);
  el("access-key").addEventListener("keydown",event=>{if(event.key==="Enter")login();});
  el("logout-btn").addEventListener("click",logout);
  el("reload-btn").addEventListener("click",async()=>{try{await load()}catch(error){msg("dashboard-message",error.message||"Ошибка обновления.");if(!accessKey)logout();}});
  el("search").addEventListener("input",applySearch);
  window.addEventListener("pagehide",()=>{accessKey="";});
});
})();
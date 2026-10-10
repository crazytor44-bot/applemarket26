(()=>{
"use strict";
const KEY="amarket_cart";
const WA="79383119888";
let ORDER_API_URL="", step="cart", previousFocus=null, submitting=false;
const cartIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
const bagIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l1.1 12H3.9L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>';
const deviceIcon='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="19" y="4" width="26" height="56" rx="6"/><path d="M28 9h8M29 54h6"/></svg>';
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("ru-RU").format(Number(n)||0)+" ₽";
const safeImage=v=>typeof v==="string"&&(/^(https:\/\/|\/(?!\/))/i.test(v.trim()))?v.trim():"";
const safePath=v=>typeof v==="string"&&/^\/(?!\/)/.test(v)?v:"/catalog/";
function fallbackImage(name){
 const n=String(name||"").toLowerCase();
 if(n.includes("18 pro max"))return "/assets/models/iphone-18-pro-max.png";
 if(n.includes("18 pro"))return "/assets/models/iphone-18-pro.png";
 if(n.includes("17 pro max"))return "/assets/models/iphone-17-pro-max.png";
 if(n.includes("17 pro"))return "/assets/models/iphone-17-pro.png";
 if(n.includes("16 pro"))return "/assets/models/iphone-16-pro.png";
 if(n.includes("iphone 16")||/\b16\b/.test(n)&&n.includes("iphone"))return "/assets/models/iphone-16.png";
 if(n.includes("15")&&n.includes("pro")||n.includes("iphone 15"))return "/assets/models/iphone-15.png";
 if(n.includes("airpods pro 3"))return "/assets/products/airpods-pro-3.jpg";
 if(n.includes("airpods pro 2"))return "/assets/products/airpods-pro-2.png";
 if(n.includes("airpods 4")&&n.includes("anc"))return "/assets/products/airpods-4-anc.jpg";
 if(n.includes("airpods 4"))return "/assets/products/airpods-4.jpg";
 if(n.includes("airtag"))return "/assets/products/airtag-1.jpg";
 if(n.includes("watch ultra"))return "/assets/products/watch-ultra3.png";
 if(n.includes("watch"))return "/assets/products/watch-s11.png";
 return "";
}
function get(){
 try{
  const value=JSON.parse(localStorage.getItem(KEY)||"[]");
  return Array.isArray(value)?value.filter(x=>x&&typeof x==="object"&&x.name&&x.id).map(x=>({
   id:String(x.id),name:String(x.name),price:Math.max(0,Number(x.price)||0),
   qty:Math.min(99,Math.max(1,Math.floor(Number(x.qty)||1))),
   image:safeImage(x.image)||fallbackImage(x.name),href:safePath(x.href)
  })):[];
 }catch{return [];}
}
function save(items){localStorage.setItem(KEY,JSON.stringify(items));draw();}
function add(item){
 if(!item||!item.name||!item.price)return;
 const items=get(),id=String(item.id||item.name),exists=items.find(x=>x.id===id);
 if(exists){exists.qty=Math.min(99,exists.qty+1);if(!exists.image&&item.image)exists.image=safeImage(item.image);}
 else items.push({id,name:String(item.name),price:Number(item.price),qty:1,image:safeImage(item.image)||fallbackImage(item.name),href:safePath(item.href)});
 save(items);step="cart";renderStep();open();
}
function quantity(id,delta){
 const items=get(),item=items.find(x=>x.id===id);if(!item)return;
 const next=item.qty+delta;
 if(next<=0){remove(id);return;}
 item.qty=Math.min(99,next);save(items);
}
function remove(id){save(get().filter(x=>x.id!==id));}
function clear(){
 if(get().length&&!window.confirm("Очистить корзину?"))return;
 save([]);step="cart";renderStep();
}
function thumbnail(item){
 const src=safeImage(item.image)||fallbackImage(item.name);
 return '<div class="am-cart-thumb">'+
  (src?'<img src="'+esc(src)+'" alt="" loading="lazy" decoding="async">':'<div class="am-cart-thumb-fallback">'+deviceIcon+'</div>')+
  '</div>';
}
function renderItems(items){
 const box=document.querySelector(".am-cart-items");if(!box)return;
 if(!items.length){
  box.innerHTML='<div class="am-cart-empty"><div class="am-cart-empty-art">'+bagIcon+'</div><h3>Здесь пока пусто</h3><p>Самое интересное уже ждёт в каталоге. Выберите свой идеальный гаджет!</p><a href="/catalog/">Перейти в каталог →</a></div>';
  return;
 }
 box.innerHTML=items.map(x=>'<article class="am-cart-item">'+thumbnail(x)+
  '<div class="am-cart-info"><a class="am-cart-item-name" href="'+esc(x.href)+'">'+esc(x.name)+'</a>'+
  '<div class="am-cart-item-sub">Наличие подтвердим при заказе</div>'+
  '<div class="am-cart-item-bottom"><div><strong class="am-cart-item-price">'+money(x.price*x.qty)+'</strong>'+
  (x.qty>1?'<div class="am-cart-item-unit">'+money(x.price)+' за шт.</div>':'')+'</div>'+
  '<div class="am-cart-qty"><button type="button" data-qty="-1" data-id="'+esc(x.id)+'" aria-label="Уменьшить количество">−</button>'+
  '<span>'+x.qty+'</span><button type="button" data-qty="1" data-id="'+esc(x.id)+'" '+(x.qty>=99?'disabled':'')+' aria-label="Увеличить количество">+</button></div></div></div>'+
  '<button class="am-cart-remove" type="button" data-remove="'+esc(x.id)+'" aria-label="Удалить товар из корзины">✕</button></article>').join("");
 box.querySelectorAll(".am-cart-thumb img").forEach(img=>img.addEventListener("error",()=>{
  const el=img.parentNode;if(el)el.innerHTML='<div class="am-cart-thumb-fallback">'+deviceIcon+'</div>';
 },{once:true}));
}
function draw(){
 const items=get(),totalCount=items.reduce((n,x)=>n+x.qty,0),total=items.reduce((n,x)=>n+x.price*x.qty,0);
 document.querySelectorAll(".am-cart-count").forEach(el=>{el.textContent=totalCount>99?"99+":totalCount;el.hidden=!totalCount;});
 const c=document.querySelector(".am-cart-head-count");if(c)c.textContent=totalCount?totalCount+" "+plural(totalCount,"товар","товара","товаров"):"Выбирайте с удовольствием";
 const heading=document.querySelector(".am-cart-section-title");if(heading)heading.textContent=totalCount?totalCount+" "+plural(totalCount,"товар","товара","товаров"):"Корзина";
 const clearBtn=document.querySelector(".am-cart-clear");if(clearBtn)clearBtn.hidden=!totalCount;
 renderItems(items);
 document.querySelectorAll(".am-cart-total").forEach(el=>el.textContent=money(total));
 document.querySelectorAll(".am-cart-subtotal").forEach(el=>el.textContent=money(total));
 const count=document.querySelector(".am-cart-summary-count");if(count)count.textContent=totalCount+" "+plural(totalCount,"товар","товара","товаров");
 if(!items.length&&step==="checkout")step="cart";
 renderStep();
}
function plural(num,one,two,many){
 const n=Math.abs(num)%100,last=n%10;
 return n>10&&n<20?many:last>1&&last<5?two:last===1?one:many;
}
function renderStep(){
 const a=document.querySelector(".am-cart-view-items"),b=document.querySelector(".am-cart-view-checkout");
 if(!a||!b)return;
 const checkout=step==="checkout"&&get().length>0;
 a.hidden=checkout;b.hidden=!checkout;
 const stepOne=document.querySelector(".am-cart-stage-one"),stepTwo=document.querySelector(".am-cart-stage-two");
 stepOne.classList.toggle("active",!checkout);stepOne.classList.toggle("done",checkout);
 stepTwo.classList.toggle("active",checkout);
 document.querySelector(".am-cart-next").hidden=checkout||get().length===0;
 document.querySelector(".am-cart-order").hidden=!checkout;
 const foot=document.querySelector(".am-cart-foot");
 if(foot)foot.hidden=get().length===0;
 const note=document.querySelector(".am-cart-method-note");
 if(note)note.textContent=ORDER_API_URL?"Без оплаты на сайте · Мы подтвердим наличие и цену":"Без оплаты на сайте · Завершение заявки в WhatsApp";
 const btn=document.querySelector(".am-cart-order");
 if(btn&&!submitting)btn.textContent=ORDER_API_URL?"Отправить заявку →":"Перейти в WhatsApp ↗";
 const scroll=document.querySelector(".am-cart-scroll");if(scroll)scroll.scrollTop=0;
}
function open(){
 previousFocus=document.activeElement;
 document.querySelector(".am-cart-panel")?.classList.add("open");
 document.querySelector(".am-cart-backdrop")?.classList.add("open");
 document.body.classList.add("am-cart-locked");
 const panel=document.querySelector(".am-cart-panel");panel?.setAttribute("aria-hidden","false");
 document.querySelector(".am-cart-close")?.focus();
}
function close(){
 document.querySelector(".am-cart-panel")?.classList.remove("open");
 document.querySelector(".am-cart-backdrop")?.classList.remove("open");
 document.body.classList.remove("am-cart-locked");
 document.querySelector(".am-cart-panel")?.setAttribute("aria-hidden","true");
 if(previousFocus&&previousFocus.focus)previousFocus.focus();
}
function toCheckout(){
 if(!get().length)return;
 step="checkout";renderStep();
 document.querySelector("#am-name")?.focus();
}
function toItems(){step="cart";renderStep();}

async function refreshCartPrices(){
 if(!get().length)return false;
 const response=await fetch("/catalog/?cart-prices="+Date.now(),{cache:"no-store"});
 if(!response.ok)throw Error("Не удалось проверить актуальные цены. Попробуйте ещё раз.");
 const doc=new DOMParser().parseFromString(await response.text(),"text/html");
 const dataNode=doc.querySelector("#catalog-data");
 if(!dataNode)throw Error("Не удалось загрузить актуальный каталог. Попробуйте позже.");
 const data=JSON.parse(dataNode.textContent),prices=new Map(data.map(p=>[String(p.id),p]));
 let changed=false;
 const items=get().map(item=>{
  const id=String(item.id).replace(/^catalog-/,"");
  const product=prices.get(id)||data.find(p=>p.name===item.name);
  if(!product||product.available===false)throw Error("Товар «"+item.name+"» недоступен в актуальном каталоге. Уточните наличие в магазине.");
  if(item.price!==Number(product.price)){changed=true;item.price=Number(product.price);}
  const card=doc.querySelector('.catalog-item[data-id="'+CSSescape(id)+'"] .model-photo img');
  const image=card&&safeImage(card.getAttribute("src"));
  if(!item.image&&image)item.image=image;
  return item;
 });
 if(changed)save(items);
 return changed;
}
function CSSescape(s){return String(s).replace(/["\\]/g,"");}

async function submit(){
 if(submitting)return;
 try{
  if(await refreshCartPrices()){
   alert("Цены в корзине обновились. Проверьте итог и нажмите «Оформить заказ» ещё раз.");
   return;
  }
 }catch(e){alert(e.message||"Не удалось проверить цены");return;}
 const items=get();if(!items.length)return;
 const name=document.querySelector("#am-name").value.trim();
 const phone=document.querySelector("#am-phone").value.trim();
 const city=document.querySelector("#am-city").value;
 const contact=document.querySelector("#am-contact").value;
 const comment=document.querySelector("#am-comment").value.trim();
 if(!name||!phone){alert("Введите имя и номер телефона");return;}
 if(!/^[+0-9()\s-]{7,25}$/.test(phone)){alert("Проверьте номер телефона");return;}
 const total=items.reduce((n,x)=>n+x.price*x.qty,0);
 const lines=items.map(x=>"• "+x.name+" — "+money(x.price)+" × "+x.qty);
 const msg=["Здравствуйте! Хочу оформить заказ:","",...lines,"","Итого: "+money(total),"","Имя: "+name,"Телефон: "+phone,city?"Город: "+city:"",contact?"Связаться: "+contact:"",comment?"Комментарий: "+comment:""].filter(Boolean).join("\n");
 const btn=document.querySelector(".am-cart-order");
 if(ORDER_API_URL){
  submitting=true;btn.disabled=true;btn.textContent="Отправляем заявку…";
  try{
   const response=await fetch(ORDER_API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,phone,city,contact,comment,items:items.map(x=>({id:String(x.id),name:String(x.name),price:Math.round(x.price),qty:x.qty})),website:""})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.ok||!result.order_id)throw Error(result.error||"Не удалось подтвердить сохранение заявки");
   save([]);close();alert("Спасибо! Ваша заявка №"+result.order_id+" принята. Мы свяжемся с вами, чтобы подтвердить наличие и цену.");
  }catch{
   alert("Не удалось подтвердить отправку заказа. Позвоните нам: +7 938 311-98-88. Если связь прервалась, сначала уточните, не поступила ли заявка.");
  }finally{submitting=false;btn.disabled=false;renderStep();}
  return;
 }
 window.open("https://wa.me/"+WA+"?text="+encodeURIComponent(msg),"_blank");
}
function imageForCurrentPage(){
 const img=document.querySelector("#product-photo, .choose-photo img, .model-gallery img, .product-gallery img, .product-photo img");
 return img?safeImage(img.currentSrc||img.getAttribute("src")):"";
}
function setupAddButtons(){
 if(location.pathname.startsWith("/catalog")){
  document.querySelectorAll(".catalog-item").forEach(card=>{
   if(card.classList.contains("model-card"))return;
   if(card.querySelector(".catalog-item-top span")?.textContent.trim()==="Аксессуары")return;
   const name=card.querySelector("h2")?.textContent.trim();
   const price=Number((card.querySelector(".catalog-item-bottom strong")?.textContent||"").replace(/\D/g,""));
   const id=card.dataset.id||name;
   if(!name||!price||card.querySelector(".am-catalog-add"))return;
   const a=card.querySelector(".catalog-buy");
   if(a){
    const button=document.createElement("button");
    button.type="button";button.className="catalog-buy am-catalog-add";button.textContent="В корзину +";
    button.addEventListener("click",e=>{
     e.preventDefault();
     const image=card.querySelector(".model-photo img, img");
     add({id:"catalog-"+id,name,price,image:image&&image.getAttribute("src"),href:"/catalog/"});
    });a.replaceWith(button);
   }
  });
 }
 const data=document.getElementById("product-data");
 if(data){
  let product;try{product=JSON.parse(data.textContent)}catch{}
  const order=document.getElementById("order");
  if(product&&order&&!document.querySelector(".am-add-cart")){
   const button=document.createElement("button");
   button.className="btn am-add-cart";button.type="button";button.textContent="Добавить в корзину +";
   order.insertAdjacentElement("afterend",button);
   button.addEventListener("click",()=>{
    const priceEl=document.getElementById("price"),selected=document.getElementById("selection");
    const choice=(selected?.textContent||"").trim();
    const price=Number((priceEl?.textContent||"").replace(/\D/g,""));
    let variant=(product.variants||[]).find(v=>choice.includes(v.name)||v.name.includes(choice));
    if(!variant){
     const mem=document.getElementById("product-memory")?.value,col=document.getElementById("product-color")?.value,region=document.getElementById("product-region")?.value;
     variant=(product.variants||[]).find(v=>(!mem||String(v.memory)===String(mem))&&(!col||v.color===col)&&(!region||v.region===region));
    }
    const image=imageForCurrentPage();
    const href=location.pathname+(location.search||"");
    const item=variant?{id:variant.id,name:(product.model?product.model+" — ":"")+variant.name,price:variant.price,image,href}:{id:location.pathname+"|"+choice,name:(product.model||document.title)+(choice&&choice!=="Выберите вариант"?" — "+choice:""),price,image,href};
    if(item.price)add(item);
   });
  }
 }
}
function init(){
 if(document.querySelector(".am-cart-panel"))return;
 document.body.insertAdjacentHTML("beforeend",
  '<button class="am-cart-fab" type="button" aria-label="Открыть корзину" title="Корзина">'+cartIcon+'<span class="am-cart-count" hidden></span></button>'+
  '<div class="am-cart-backdrop"></div>'+
  '<aside class="am-cart-panel" role="dialog" aria-modal="true" aria-label="Корзина А Маркет" aria-hidden="true">'+
   '<div class="am-cart-head"><div class="am-cart-symbol">AM</div><div class="am-cart-head-copy"><span class="am-cart-head-kicker">А МАРКЕТ · ВАШ ВЫБОР</span><h2>Корзина</h2><div class="am-cart-head-count"></div></div><button class="am-cart-close" type="button" aria-label="Закрыть корзину">✕</button></div>'+
   '<div class="am-cart-progress"><div class="am-cart-stage am-cart-stage-one active"><span class="am-cart-stage-n">1</span>Корзина</div><div class="am-cart-stage am-cart-stage-two"><span class="am-cart-stage-n">2</span>Оформление</div></div>'+
   '<div class="am-cart-scroll">'+
    '<section class="am-cart-view am-cart-view-items"><div class="am-cart-title-row"><h3 class="am-cart-section-title">Ваши товары</h3><button class="am-cart-clear" type="button">Очистить всё</button></div><div class="am-cart-items"></div><div class="am-cart-support"><div class="am-cart-support-icon">✦</div><div><strong>Покупайте спокойно</strong><span>Сначала уточним наличие и подтвердим цену</span></div></div></section>'+
    '<section class="am-cart-view am-cart-view-checkout am-checkout" hidden><button class="am-cart-back" type="button">← Вернуться в корзину</button><h3 class="am-cart-checkout-title">Остался один шаг</h3><p class="am-cart-checkout-note">Оставьте контакты — согласуем заказ и ответим на ваши вопросы.</p>'+
     '<div class="am-cart-section-card"><h3>01 / Контактные данные</h3><div class="am-cart-checkout-grid">'+
      '<label>Ваше имя <em>*</em><input id="am-name" autocomplete="name" maxlength="80" placeholder="Как к вам обращаться?"></label>'+
      '<label>Телефон <em>*</em><input id="am-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" placeholder="+7 (___) ___-__-__"></label>'+
      '<label>Город<select id="am-city"><option value="">Не указывать</option><option>Ставрополь</option><option>Другой город</option></select></label>'+
      '<label>Как связаться?<select id="am-contact"><option value="">Как удобно</option><option>WhatsApp</option><option>Позвонить</option><option>Telegram</option></select></label>'+
     '</div></div>'+
     '<div class="am-cart-section-card"><h3>02 / Пожелания к заказу</h3><label>Комментарий<textarea id="am-comment" maxlength="1000" placeholder="Например: интересует доставка или рассрочка"></textarea></label><p class="am-cart-privacy">Ваши данные используются для ответа по заказу. <a href="/privacy/" target="_blank" rel="noopener noreferrer">Политика обработки персональных данных ↗</a></p></div>'+
    '</section>'+
   '</div>'+
   '<div class="am-cart-foot"><div class="am-cart-cost-row"><span class="am-cart-summary-count">Товары</span><b class="am-cart-subtotal">0 ₽</b></div><div class="am-cart-total-row"><span>Итого</span><strong class="am-cart-total">0 ₽</strong></div><div class="am-cart-foot-note am-cart-method-note">Без оплаты на сайте · Наличие подтвердим</div><button class="am-cart-primary am-cart-next" type="button">Перейти к оформлению <span>→</span></button><button class="am-cart-primary am-cart-order" type="button" hidden>Перейти в WhatsApp ↗</button><p class="am-cart-note">Цена и наличие подтверждаются при оформлении</p></div>'+
  '</aside>'
 );
 document.querySelector(".am-cart-fab").onclick=()=>{step="cart";renderStep();open();};
 document.querySelector(".am-cart-close").onclick=close;
 document.querySelector(".am-cart-backdrop").onclick=close;
 document.querySelector(".am-cart-next").onclick=toCheckout;
 document.querySelector(".am-cart-back").onclick=toItems;
 document.querySelector(".am-cart-clear").onclick=clear;
 document.querySelector(".am-cart-order").onclick=submit;
 document.querySelector(".am-cart-items").addEventListener("click",e=>{
  const qty=e.target.closest("[data-qty]"),del=e.target.closest("[data-remove]");
  if(qty){quantity(qty.dataset.id,Number(qty.dataset.qty));}
  else if(del){remove(del.dataset.remove);}
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.querySelector(".am-cart-panel")?.classList.contains("open"))close();});
 setupAddButtons();draw();
}
if(typeof fetch==="function")fetch("/assets/orders-config.json",{cache:"no-store"}).then(r=>r.ok?r.json():{}).then(c=>{
 if(typeof c.apiUrl==="string"&&/^https:\/\//.test(c.apiUrl))ORDER_API_URL=c.apiUrl;
 renderStep();
}).catch(()=>{});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.AMarketCart={add,open};
})();
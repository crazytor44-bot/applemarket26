(()=>{'use strict';
/* Favorites v1 is isolated from checkout, Telegram imports and their prices. */
const KEY='amarket_favorites_v1',MAX=60;
const heart='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 4.6a5.4 5.4 0 0 0-7.7 0L12 5.5l-.9-.9a5.4 5.4 0 0 0-7.7 7.6L12 21l8.6-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg>';
const safeText=s=>String(s||'').trim().slice(0,150);
const safePath=s=>typeof s==='string'&&/^\/(?!\/)/.test(s)&&!/[<>"']/g.test(s)?s:'/catalog/';
const safeImage=s=>typeof s==='string'&&(/^(https:\/\/|\/(?!\/))/i).test(s)&&!/[<>"']/g.test(s)?s:'';
const normalize=e=>e&&typeof e.key==='string'&&/^[a-zа-яё0-9][a-zа-яё0-9_-]{1,110}$/i.test(e.key)?
 {key:e.key,title:safeText(e.title)||'Техника',href:safePath(e.href),image:safeImage(e.image),kind:['phones','headphones','dyson','playstation'].includes(e.kind)?e.kind:''}:null;
function read(){
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(saved)?saved.map(normalize).filter(Boolean).slice(0,MAX):[];}
 catch(e){return [];}
}
let saved=read(),lastFocus=null,livePrices=null,pending=null,scanning=false;
const get=e=>saved.find(x=>x.key===e);
function kindFrom(key,title){
 const t=String(title||'');
 if(/^iphone-/.test(key)||/^samsung-(?:s\d|a\d|z-|galaxy-a)/.test(key))return'phones';
 if(/airpods|galaxy buds|marshall|наушник/i.test(t)||/^(airpods|audio-|samsung-buds)/.test(key))return'headphones';
 if(/dyson/i.test(t)||/^beauty-dyson/.test(key))return'dyson';
 if(/playstation|\bps5\b/i.test(t)||/^gaming-ps5/.test(key))return'playstation';
 return'';
}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(e){}
 refresh();
}
function toggle(entry){
 const e=normalize(entry);if(!e)return;
 const i=saved.findIndex(x=>x.key===e.key);
 if(i>=0)saved.splice(i,1);
 else{if(saved.length>=MAX){window.alert?.('Можно сохранить не больше '+MAX+' товаров.');return;}saved.unshift(e);}
 save();
}
function remove(key){saved=saved.filter(x=>x.key!==key);save();}
function makeHeart(entry){
 const btn=document.createElement('button');
 btn.type='button';btn.className='am-fav-heart';btn.dataset.favKey=entry.key;
 btn.innerHTML=heart;
 updateHeart(btn,entry);
 btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggle(entry);});
 return btn;
}
function updateHeart(btn,entry){
 const active=!!get(entry.key);
 btn.classList.toggle('is-active',active);
 btn.setAttribute('aria-pressed',String(active));
 btn.setAttribute('aria-label',(active?'Убрать из избранного: ':'В избранное: ')+entry.title);
 btn.title=active?'Убрать из избранного':'Добавить в избранное';
}
function catalogCard(card){
 if(!card)return null;
 const key=card.dataset.id;if(!key)return null;
 const title=safeText(card.querySelector('h2')?.textContent)||'Товар';
 const link=card.querySelector('.model-photo')?.getAttribute('href')||card.querySelector('.catalog-buy')?.getAttribute('href');
 const image=card.querySelector('.model-photo img')?.getAttribute('src');
 return normalize({key,title,href:link,image,kind:kindFrom(key,title)});
}
function detailCard(){
 const key=location.pathname.replace(/^\/|\/$/g,'');
 if(!/^(?:iphone|samsung)-[a-z0-9-]+$/.test(key))return null;
 const title=safeText(document.querySelector('#product-title')?.textContent);
 if(!title)return null;
 return normalize({key,title,image:document.querySelector('#product-photo')?.getAttribute('src'),href:location.pathname,kind:kindFrom(key,title)});
}
function chooseCard(){
 const select=document.querySelector('#variant-select'),title=safeText(document.querySelector('#choose-title')?.textContent);
 if(!select?.value||!title||title.includes('Загружаем'))return null;
 try{
  const data=JSON.parse(document.querySelector('#choose-data')?.textContent||'{}');
  const group=Object.entries(data).find(([,vs])=>Array.isArray(vs)&&vs.some(v=>v.id===select.value));
  if(!group)return null;
  const [key]=group;
  const product=group[1].find(v=>v.id===select.value);
  const image=document.querySelector('#choose-photo')?.getAttribute('src');
  return normalize({key,title,href:'/choose/?variant='+encodeURIComponent(product.id),image,kind:kindFrom(key,title)});
 }catch(e){return null;}
}
function scan(){
 const grid=document.querySelector('#catalog-grid');
 if(grid){grid.querySelectorAll('.catalog-item[data-id]').forEach(card=>{
  if(card.querySelector('.am-fav-heart'))return;
  const e=catalogCard(card);if(e)card.appendChild(makeHeart(e));
 });}
 const gallery=document.querySelector('.product-layout .gallery');
 if(gallery&&!gallery.querySelector('.am-fav-heart')){
  const e=detailCard();if(e)gallery.appendChild(makeHeart(e));
 }
 const photo=document.querySelector('.choose-photo');
 if(photo){
  const e=chooseCard(),old=photo.querySelector('.am-fav-heart');
  if(e&&old?.dataset.favKey!==e.key)old.remove();
  if(e&&!photo.querySelector('.am-fav-heart'))photo.appendChild(makeHeart(e));
 }
}
function queueScan(){if(scanning)return;scanning=true;setTimeout(()=>{scanning=false;scan();},70);}
function refresh(){
 document.querySelectorAll('.am-fav-heart').forEach(btn=>{
  const key=btn.dataset.favKey,entry=catalogCard(btn.closest('.catalog-item'))||((key===location.pathname.replace(/^\/|\/$/g,''))?detailCard():null)||chooseCard();
  if(entry&&entry.key===key)updateHeart(btn,entry);
 });
 const count=document.querySelector('.am-fav-count');
 if(count){count.textContent=String(saved.length);count.hidden=!saved.length;}
 const panel=document.querySelector('.am-fav-panel');
 if(panel?.classList.contains('open'))renderList();
}
const rub=n=>new Intl.NumberFormat('ru-RU').format(Number(n))+' ₽';
async function getLatest(){
 if(pending)return pending;
 pending=(async()=>{
  const doc=document.querySelector('#catalog-data');
  let json;
  if(doc){json=JSON.parse(doc.textContent);}
  else{
   const r=await fetch('/catalog/?favorites='+Date.now(),{cache:'no-store'});
   if(!r.ok)throw Error('catalog unavailable');
   const html=new DOMParser().parseFromString(await r.text(),'text/html');
   json=JSON.parse(html.querySelector('#catalog-data').textContent);
  }
  const groups=new Map();
  for(const p of json){const key=p.groupKey||p.id;if(!key)continue;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(p);
  }
  return groups;
 })().then(x=>{livePrices=x;return x;}).finally(()=>{pending=null;});
 return pending;
}
function itemMeta(entry){
 if(!livePrices)return'Проверяем актуальную цену…';
 const options=livePrices.get(entry.key);
 if(!options?.length)return'Цену и наличие уточняйте в карточке';
 const available=options.filter(x=>x.available!==false&&Number.isFinite(Number(x.price)));
 if(!available.length)return'Нет в наличии · Уточните поступление';
 return'от '+rub(Math.min(...available.map(x=>Number(x.price))))+' · Наличие уточняйте';
}
function renderList(){
 const list=document.querySelector('.am-fav-list'),compare=document.querySelector('.am-fav-compare');
 if(!list)return;
 const chosen=[...list.querySelectorAll('.am-fav-select')].filter(x=>x.checked).map(x=>x.value);
 list.replaceChildren();
 if(!saved.length){
  const empty=document.createElement('div');empty.className='am-fav-empty';
  empty.innerHTML='<div aria-hidden="true">♡</div><h3>Пока ничего нет</h3><p>Нажимайте на сердечки у товаров в каталоге. Выбранное сохранится в этом браузере.</p><a href="/catalog/">Перейти в каталог →</a>';
  list.appendChild(empty);
 }
 for(const entry of saved){
  const row=document.createElement('div');row.className='am-fav-row';
  const link=document.createElement('a');link.className='am-fav-row-link';link.href=safePath(entry.href);
  const thumb=document.createElement('div');thumb.className='am-fav-thumb';
  if(entry.image){const img=document.createElement('img');img.src=safeImage(entry.image);img.alt='';img.loading='lazy';img.onerror=()=>{img.remove();};thumb.appendChild(img);}
  const info=document.createElement('div');info.className='am-fav-row-info';
  const name=document.createElement('strong');name.textContent=entry.title;
  const meta=document.createElement('span');meta.className='am-fav-price';meta.textContent=itemMeta(entry);
  const view=document.createElement('span');view.className='am-fav-see';view.textContent='Выбрать вариант ↗';
  info.append(name,meta,view);link.append(thumb,info);
  const actions=document.createElement('div');actions.className='am-fav-actions';
  if(entry.kind){const label=document.createElement('label');label.className='am-fav-choice';
   const input=document.createElement('input');input.className='am-fav-select';input.type='checkbox';input.value=entry.key;input.checked=chosen.includes(entry.key);
   const labelText=document.createElement('span');labelText.textContent='Сравнить';
   label.append(input,labelText);actions.appendChild(label);
   input.addEventListener('change',updateCompare);
  }
  const removeButton=document.createElement('button');removeButton.type='button';removeButton.className='am-fav-remove';removeButton.textContent='Убрать ×';removeButton.setAttribute('aria-label','Убрать '+entry.title+' из избранного');
  removeButton.addEventListener('click',()=>remove(entry.key));actions.appendChild(removeButton);
  row.append(link,actions);list.appendChild(row);
 }
 document.querySelector('.am-fav-clear').hidden=!saved.length;
 updateCompare();
}
function updateCompare(){
 const selected=[...document.querySelectorAll('.am-fav-select')].filter(x=>x.checked);
 const info=document.querySelector('.am-fav-compare-note'),link=document.querySelector('.am-fav-compare');
 if(!link)return;
 const ids=selected.map(x=>x.value),items=ids.map(get);
 const kind=items[0]?.kind,valid=items.length===2&&items.every(x=>x&&x.kind===kind);
 link.hidden=!valid;
 if(valid){link.href='/compare/?kind='+encodeURIComponent(kind)+'&left='+encodeURIComponent(items[0].key)+'&right='+encodeURIComponent(items[1].key);}
 if(info)info.textContent=items.length===0?'Отметьте два товара одной категории, чтобы сравнить.':items.length===1?'Выберите ещё один товар для сравнения.':valid?'Готово! Можно сравнить выбранные устройства.':'Выберите два товара одной категории.';
 document.querySelectorAll('.am-fav-select').forEach(x=>{x.disabled=items.length>=2&&!x.checked;});
}
function open(){
 if(document.body.classList.contains('am-cart-locked'))return;
 lastFocus=document.activeElement;
 const overlay=document.querySelector('.am-fav-backdrop'),panel=document.querySelector('.am-fav-panel');
 overlay.classList.add('open');panel.classList.add('open');panel.setAttribute('aria-hidden','false');
 document.body.classList.add('am-fav-locked');
 livePrices=null;renderList();
 document.querySelector('.am-fav-close').focus();
 getLatest().then(()=>{if(panel.classList.contains('open'))renderList();}).catch(()=>{
  if(panel.classList.contains('open')){
   livePrices=new Map();renderList();
  }
 });
}
function close(){
 const overlay=document.querySelector('.am-fav-backdrop'),panel=document.querySelector('.am-fav-panel');
 overlay.classList.remove('open');panel.classList.remove('open');
 panel.setAttribute('aria-hidden','true');document.body.classList.remove('am-fav-locked');
 lastFocus?.focus?.();
}
// Keep the opener in the normal page flow, never floating over product photography.
function mountLaunchButton(){
 const button=document.querySelector('.am-fav-launch');
 if(!button)return;
 const heading=document.querySelector('.catalog-intro h1');
 if(heading){
  let row=heading.closest('.am-fav-heading-row');
  if(!row){
   row=document.createElement('div');
   row.className='am-fav-heading-row';
   heading.parentElement.insertBefore(row,heading);
   row.append(heading);
  }
  const cart=row.querySelector('.am-cart-fab');
  if(cart)row.insertBefore(button,cart);
  else row.appendChild(button);
  button.classList.add('am-fav-launch--catalog');
  return;
 }
 // Other product pages still need a way to open their saved products.
 const header=document.querySelector('header .wrap');
 if(header){
  const cart=header.querySelector('.am-cart-fab');
  const contact=header.querySelector('.contact');
  if(cart)header.insertBefore(button,cart);
  else if(contact)header.insertBefore(button,contact);
  else header.appendChild(button);
  button.classList.add('am-fav-launch--header');
 }else{
  const main=document.querySelector('main');
  if(main)main.prepend(button);
 }
}
function init(){
 if(document.querySelector('.am-fav-panel'))return;
 document.body.insertAdjacentHTML('beforeend',
  '<button type="button" class="am-fav-launch" aria-label="Открыть избранное" title="Избранное">'+heart+'<span class="am-fav-launch-label">Избранное</span><span class="am-fav-count" hidden></span></button>'+
  '<div class="am-fav-backdrop"></div>'+
  '<aside class="am-fav-panel" role="dialog" aria-modal="true" aria-label="Избранное А Маркет" aria-hidden="true">'+
   '<header class="am-fav-head"><div><div class="am-fav-kicker">А МАРКЕТ · ВАШ ВЫБОР</div><h2>Избранное <span>♡</span></h2><p>Всё, что понравилось — в одном месте.</p></div><button type="button" class="am-fav-close" aria-label="Закрыть избранное">×</button></header>'+
   '<div class="am-fav-list"></div>'+
   '<div class="am-fav-bottom"><p class="am-fav-compare-note">Отметьте два товара одной категории, чтобы сравнить.</p><a class="am-fav-compare" href="/compare/" hidden>Сравнить выбранное ↗</a>'+
    '<div class="am-fav-bottom-actions"><a href="/catalog/">Каталог товаров ↗</a><button type="button" class="am-fav-clear" hidden>Очистить избранное</button></div></div>'+
  '</aside>');
 mountLaunchButton();
 document.querySelector('.am-fav-launch').addEventListener('click',open);
 document.querySelector('.am-fav-close').addEventListener('click',close);
 document.querySelector('.am-fav-backdrop').addEventListener('click',close);
 document.querySelector('.am-fav-clear').addEventListener('click',()=>{
  if(saved.length&&window.confirm?.('Удалить все товары из избранного?')){saved=[];save();}
 });
 document.addEventListener('keydown',e=>{
  const panel=document.querySelector('.am-fav-panel');
  if(!panel.classList.contains('open'))return;
  if(e.key==='Escape'){close();return;}
  if(e.key==='Tab'){
   const focusable=[...panel.querySelectorAll('button:not([hidden]):not([disabled]),a:not([hidden]),input:not([disabled])')].filter(x=>x.getClientRects().length);
   if(!focusable.length)return;
   if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable[focusable.length-1].focus();}
   else if(!e.shiftKey&&document.activeElement===focusable[focusable.length-1]){e.preventDefault();focusable[0].focus();}
  }
 });
 window.addEventListener('storage',e=>{if(e.key===KEY){saved=read();refresh();}});
 document.addEventListener('change',e=>{if(e.target.id==='variant-select')queueScan();});
 const grid=document.querySelector('#catalog-grid');
 if(grid&&typeof MutationObserver!=='undefined'){
  const observer=new MutationObserver(queueScan);
  observer.observe(grid,{childList:true,subtree:true});
 }
 if(document.querySelector('.choose-photo')&&typeof MutationObserver!=='undefined'){
  const observer=new MutationObserver(queueScan);
  observer.observe(document.querySelector('.choose-panel'),{childList:true,subtree:true});
 }
 scan();refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.AMarketFavorites={open,all:()=>saved.slice(),toggle};
})();

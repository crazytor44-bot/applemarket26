(()=>{'use strict';
/* iPhone 18 availability/pricing hotfix — 2026-09-25 */
const path=location.pathname;
const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
const pro=[
{id:'p18-256-black-esim',name:'iPhone 18 Pro 256GB Black eSIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:128990,url:'/iphone-18-pro/',preorder:false,color:'Black',region:'eSIM'},
{id:'p18-256-silver-esim',name:'iPhone 18 Pro 256GB Silver eSIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:125490,url:'/iphone-18-pro/',preorder:false,color:'Silver',region:'eSIM'},
{id:'p18-256-glacier-esim',name:'iPhone 18 Pro 256GB Glacier eSIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:126990,url:'/iphone-18-pro/',preorder:false,color:'Glacier',region:'eSIM'},
{id:'p18-256-black-sim',name:'iPhone 18 Pro 256GB Black 1 SIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:138990,url:'/iphone-18-pro/',preorder:false,color:'Black',region:'1 SIM'},
{id:'p18-256-burgundy-sim',name:'iPhone 18 Pro 256GB Burgundy 1 SIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:140990,url:'/iphone-18-pro/',preorder:false,color:'Burgundy',region:'1 SIM'},
{id:'p18-256-silver-sim',name:'iPhone 18 Pro 256GB Silver 1 SIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:138990,url:'/iphone-18-pro/',preorder:false,color:'Silver',region:'1 SIM'},
{id:'p18-256-glacier-sim',name:'iPhone 18 Pro 256GB Glacier 1 SIM',category:'iphone',model:'iPhone 18 Pro',memory:256,price:138990,url:'/iphone-18-pro/',preorder:false,color:'Glacier',region:'1 SIM'},
{id:'p18-256-silver-hk',name:'iPhone 18 Pro 256GB Silver 1 SIM HK active',category:'iphone',model:'iPhone 18 Pro',memory:256,price:125990,url:'/iphone-18-pro/',preorder:false,color:'Silver',region:'1 SIM · HK active'},
{id:'p18-256-glacier-hk',name:'iPhone 18 Pro 256GB Glacier 1 SIM HK active',category:'iphone',model:'iPhone 18 Pro',memory:256,price:125990,url:'/iphone-18-pro/',preorder:false,color:'Glacier',region:'1 SIM · HK active'},
{id:'p18-512-burgundy-esim',name:'iPhone 18 Pro 512GB Burgundy eSIM',category:'iphone',model:'iPhone 18 Pro',memory:512,price:158990,url:'/iphone-18-pro/',preorder:false,color:'Burgundy',region:'eSIM'},
{id:'p18-512-burgundy-sim',name:'iPhone 18 Pro 512GB Burgundy 1 SIM',category:'iphone',model:'iPhone 18 Pro',memory:512,price:170990,url:'/iphone-18-pro/',preorder:false,color:'Burgundy',region:'1 SIM'}];
const max=[
{id:'p18m-256-black-esim',name:'iPhone 18 Pro Max 256GB Black eSIM',category:'iphone',model:'iPhone 18 Pro Max',memory:256,price:156990,url:'/iphone-18-pro-max/',preorder:false,color:'Black',region:'eSIM'},
{id:'p18m-256-burgundy-esim',name:'iPhone 18 Pro Max 256GB Burgundy eSIM',category:'iphone',model:'iPhone 18 Pro Max',memory:256,price:159990,url:'/iphone-18-pro-max/',preorder:false,color:'Burgundy',region:'eSIM'},
{id:'p18m-256-glacier-esim',name:'iPhone 18 Pro Max 256GB Glacier eSIM',category:'iphone',model:'iPhone 18 Pro Max',memory:256,price:151990,url:'/iphone-18-pro-max/',preorder:false,color:'Glacier',region:'eSIM'},
{id:'p18m-256-burgundy-sim',name:'iPhone 18 Pro Max 256GB Burgundy 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:256,price:173990,url:'/iphone-18-pro-max/',preorder:false,color:'Burgundy',region:'1 SIM'},
{id:'p18m-256-silver-sim',name:'iPhone 18 Pro Max 256GB Silver 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:256,price:163990,url:'/iphone-18-pro-max/',preorder:false,color:'Silver',region:'1 SIM'},
{id:'p18m-256-glacier-sim',name:'iPhone 18 Pro Max 256GB Glacier 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:256,price:160990,url:'/iphone-18-pro-max/',preorder:false,color:'Glacier',region:'1 SIM'},
{id:'p18m-512-black-sim',name:'iPhone 18 Pro Max 512GB Black 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:512,price:173990,url:'/iphone-18-pro-max/',preorder:false,color:'Black',region:'1 SIM'},
{id:'p18m-512-burgundy-sim',name:'iPhone 18 Pro Max 512GB Burgundy 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:512,price:182990,url:'/iphone-18-pro-max/',preorder:false,color:'Burgundy',region:'1 SIM'},
{id:'p18m-512-silver-sim',name:'iPhone 18 Pro Max 512GB Silver 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:512,price:168990,url:'/iphone-18-pro-max/',preorder:false,color:'Silver',region:'1 SIM'},
{id:'p18m-512-glacier-sim',name:'iPhone 18 Pro Max 512GB Glacier 1 SIM',category:'iphone',model:'iPhone 18 Pro Max',memory:512,price:171990,url:'/iphone-18-pro-max/',preorder:false,color:'Glacier',region:'1 SIM'}];
function patchProduct(variants){
 const data=document.getElementById('product-data'); if(data){const d=JSON.parse(data.textContent);d.variants=variants;data.textContent=JSON.stringify(d);}
 const images=document.getElementById('product-images');if(images){const d=JSON.parse(images.textContent);if(d.Blue&&!d.Glacier)d.Glacier=d.Blue;images.textContent=JSON.stringify(d);}
 const eyebrow=document.querySelector('.config .eyebrow');if(eyebrow)eyebrow.textContent='В наличии';
 const delivery=document.querySelector('.config .delivery');if(delivery)delivery.textContent='В наличии · Ставрополь';
 const status=document.getElementById('variant-status');if(status)status.textContent='В наличии · Ставрополь';
 const price=document.getElementById('price');if(price)price.textContent='от '+money(Math.min(...variants.map(v=>v.price)));
 const order=document.getElementById('order');if(order)order.textContent='Заказать в WhatsApp ↗';
 const desc=document.querySelector('meta[name="description"]');if(desc)desc.content=desc.content.replace(/Выдача 26–27 сентября · ?/g,'В наличии · ');
}
if(path==='/iphone-18-pro/'||path==='/iphone-18-pro/index.html')patchProduct(pro);
if(path==='/iphone-18-pro-max/'||path==='/iphone-18-pro-max/index.html')patchProduct(max);
if(path==='/'){
 const hero=document.querySelector('.hero');if(hero){const e=hero.querySelector('.eyebrow');if(e)e.textContent='iPhone 18 в наличии';const p=hero.querySelector('p');if(p)p.innerHTML='Pro и Pro Max. Выбери свой.<br>В наличии в Ставрополе.';}
 document.querySelectorAll('.product-card').forEach(card=>{const h=card.querySelector('h3');if(!h)return;const isPro=h.textContent.trim()==='iPhone 18 Pro',isMax=h.textContent.trim()==='iPhone 18 Pro Max';if(!isPro&&!isMax)return;const badge=card.querySelector('.badge');if(badge)badge.textContent='В наличии';const subtle=card.querySelector('.subtle');if(subtle)subtle.textContent=isPro?'256 / 512 ГБ · Black, Burgundy, Silver, Glacier':'256 / 512 ГБ · Black, Burgundy, Silver, Glacier';const strong=card.querySelector('.price-row strong');if(strong)strong.textContent='от '+money(isPro?125490:151990);});
 const heading=[...document.querySelectorAll('.heading h2')].find(x=>x.textContent.includes('предзаказ'));if(heading)heading.textContent='iPhone 18 в наличии';
 const md=document.querySelector('meta[name="description"]');if(md)md.content=md.content.replace(/и предзаказ iPhone 18/,'и iPhone 18 в наличии');
}
if(path.startsWith('/catalog')){
 const intro=document.querySelector('.catalog-intro .subtle');if(intro)intro.textContent='Выберите вариант и уточните наличие. iPhone 18 Pro и Pro Max — в наличии.';
 document.querySelectorAll('.catalog-item').forEach(card=>{const h=card.querySelector('h2');if(!h)return;const t=h.textContent.trim();if(t==='iPhone 18 Pro'||t==='iPhone 18 Pro Max'){const strong=card.querySelector('.catalog-item-bottom strong');if(strong)strong.textContent='от '+money(t==='iPhone 18 Pro'?125490:151990);const meta=card.querySelector('.catalog-item-meta');if(meta)meta.innerHTML='256 / 512 ГБ<br>Black · Burgundy · Silver · Glacier<br>В наличии';}});
}

const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
if(preference.matches||!('IntersectionObserver' in window)||!Element.prototype.animate)return;
const active=new Set(),seen=new WeakSet();
const selector='.hero,.heading,.category,.product-card,.service,.review,.info-card,.info-image,.catalog-item,.color-gallery,.config,.trade-request,.compare-device';
const observer=new IntersectionObserver(entries=>{for(const entry of entries){const el=entry.target;if(!entry.isIntersecting||!entry.intersectionRect.width||!entry.intersectionRect.height)continue;observer.unobserve(el);if(seen.has(el)||preference.matches)continue;seen.add(el);if(el.contains(document.activeElement))continue;const animation=el.animate([{opacity:.35,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.2,.65,.3,1)'});active.add(animation);animation.finished.catch(()=>{}).finally(()=>active.delete(animation));}}, {threshold:0,rootMargin:'0px 0px -12px 0px'});
document.querySelectorAll(selector).forEach(el=>observer.observe(el));
function stop(){if(!preference.matches)return;observer.disconnect();for(const a of active)a.cancel();active.clear();}
if(preference.addEventListener)preference.addEventListener('change',stop);else preference.addListener(stop);
document.addEventListener('focusin',()=>{for(const a of active)a.cancel();active.clear();});
})();
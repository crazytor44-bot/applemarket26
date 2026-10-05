(()=>{'use strict';
const path=location.pathname;
function stock18(){
 if(path.startsWith('/catalog')){
  const intro=document.querySelector('.catalog-intro .subtle');
  if(intro) intro.textContent='Выберите вариант и уточните наличие. iPhone 18 Pro и Pro Max — в наличии.';
  document.querySelectorAll('.catalog-item').forEach(card=>{
   const h=card.querySelector('h2'); if(!h)return;
   const t=h.textContent.trim();
   if(t==='iPhone 18 Pro'||t==='iPhone 18 Pro Max'){
    const meta=card.querySelector('.catalog-item-meta'); if(meta)meta.innerHTML='256 / 512 ГБ<br>Black · Burgundy · Silver · Glacier<br>В наличии';
    const price=card.querySelector('.catalog-item-bottom strong'); if(price)price.textContent=t==='iPhone 18 Pro'?'от 125 490 ₽':'от 151 990 ₽';
   }
  });
 }
 if(path==='/'){
  const hero=document.querySelector('.hero'); if(hero){const e=hero.querySelector('.eyebrow');if(e)e.textContent='iPhone 18 в наличии';}
  document.querySelectorAll('.product-card').forEach(card=>{const h=card.querySelector('h3');if(!h)return;const t=h.textContent.trim();if(t==='iPhone 18 Pro'||t==='iPhone 18 Pro Max'){const b=card.querySelector('.badge');if(b)b.textContent='В наличии';}});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stock18);else stock18();

const METRIKA_ID=109374177;
function sendLeadGoal(goal,meta={}){
 try{
  if(typeof window.ym==='function')window.ym(METRIKA_ID,'reachGoal',goal,{page:location.pathname,...meta});
 }catch(e){}
}
function decodeHref(href){
 try{return decodeURIComponent(String(href||'').replace(/\+/g,' '));}catch(e){return String(href||'');}
}
document.addEventListener('click',event=>{
 const link=event.target.closest&&event.target.closest('a[href*="wa.me/"]');
 if(!link)return;
 const raw=decodeHref(link.getAttribute('href')||link.href),label=(link.textContent||'').trim();
 const text=(raw+' '+label).toLowerCase();
 if(/стоимость ремонта|ремонт телефона|по ремонту/.test(text))return sendLeadGoal('lead_repair',{label});
 if(/trade-?in|обменять телефон|продать телефон|оценить телефон/.test(text))return sendLeadGoal('lead_tradein',{label});
 if(/подобрать iphone/.test(text))return sendLeadGoal('lead_iphone_help',{label});
 if(/налич/.test(text))return sendLeadGoal('lead_stock',{label});
},true);
document.addEventListener('submit',event=>{
 if(event.target&&event.target.id==='trade-form')sendLeadGoal('lead_tradein',{label:'trade-form'});
},true);
})();
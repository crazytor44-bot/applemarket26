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
})();
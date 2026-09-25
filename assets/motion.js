(()=>{'use strict';
/* Catalog priority: iPhone first when "Все" is selected. */
if(location.pathname.startsWith('/catalog')){
 const grid=document.getElementById('catalog-grid');
 const allButton=document.querySelector('[data-category=""]');
 const iphoneButton=document.querySelector('[data-category="iphone"]');
 const samsungButton=document.querySelector('[data-category="samsung"]');
 const reorder=()=>{
   if(!grid||!allButton||allButton.getAttribute('aria-pressed')!=='true')return;
   const cards=[...grid.querySelectorAll('.catalog-item')];
   const rank=card=>{
     const text=(card.textContent||'').toLowerCase();
     const href=(card.querySelector('a')?.getAttribute('href')||'').toLowerCase();
     if(text.includes('iphone')||href.includes('/iphone'))return 0;
     if(text.includes('samsung')||href.includes('/samsung'))return 1;
     return 2;
   };
   cards.map((card,i)=>({card,i,r:rank(card)})).sort((a,b)=>a.r-b.r||a.i-b.i).forEach(x=>grid.appendChild(x.card));
 };
 reorder();
 document.querySelector('.catalog-categories')?.addEventListener('click',()=>setTimeout(reorder,0));
 const observer=new MutationObserver(()=>reorder());
 if(grid)observer.observe(grid,{childList:true});
}
})();
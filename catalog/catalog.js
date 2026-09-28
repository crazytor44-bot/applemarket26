(() => {
const products=JSON.parse(document.querySelector('#catalog-data').textContent);
const form=document.querySelector('#catalog-filters');
const fields={query:document.querySelector('#catalog-query'),model:document.querySelector('#catalog-model'),memory:document.querySelector('#catalog-memory'),min:document.querySelector('#catalog-min'),max:document.querySelector('#catalog-max')};
const buttons=[...document.querySelectorAll('[data-category]')];
const grid=document.querySelector('#catalog-grid');
const cards=new Map([...document.querySelectorAll('.catalog-item')].map(card=>[card.dataset.id,card]));
const grouped=new Map();
products.forEach(p=>{const key=p.groupKey||p.id;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(p);});
function targetUrl(p){return p.page?p.page+'?variant='+encodeURIComponent(p.id):p.url;}
const photoMap={"samsung-a17":"https://images.samsung.com/is/image/samsung/p6pim/de/sm-a176bzkdeub/gallery/de-galaxy-a17-5g-sm-a176-sm-a176bzkdeub-548753932?$1164_776_PNG$=","samsung-a37":"https://images.samsung.com/is/image/samsung/p6pim/ru/sm-a376edgdcau/gallery/ru-galaxy-a37-5g-sm-a376-sm-a376edgdcau-551713449?$1164_776_PNG$=","samsung-a57":"https://images.samsung.com/is/image/samsung/assets/de/offer/galaxy-a57/carousel/260320_a57_multi_cutout_carousel_buypage_1600x864px.png?imbypass=true","samsung-z-flip-8":"https://img.global.news.samsung.com/uk/wp-content/uploads/2026/07/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-A-First-Look_main10.jpg","samsung-z-fold-8":"https://img.global.news.samsung.com/uk/wp-content/uploads/2026/07/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-A-First-Look_main6.jpg","samsung-z-fold-8-ultra":"https://img.global.news.samsung.com/uk/wp-content/uploads/2026/07/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-A-First-Look_main2.jpg","samsung-buds-4":"https://images.samsung.com/kdp/static/pd/buds/galaxy-buds4/SM-R540N_web_00_KV.jpg","samsung-buds-4-pro":"https://images.samsung.com/ru/galaxy-buds4-pro/feature/galaxy-buds4-pro-kv.jpg?imbypass=true","samsung-watch-ultra":"https://images.samsung.com/is/image/samsung/p6pim/ru/f2507/gallery/ru-galaxy-watch-ultra-2025-l705-sm-l705fzb1cau-547608533?$1164_776_PNG$=","airpods-5":"https://www.apple.com/newsroom/images/2026/09/apple-introduces-airpods-5-with-best-in-class-open-ear-active-noise-cancellation/article/Apple-AirPods-5-hero-260909_big.jpg.large.jpg","airpods-5-wireless":"https://www.apple.com/newsroom/images/2026/09/apple-introduces-airpods-5-with-best-in-class-open-ear-active-noise-cancellation/article/Apple-AirPods-5-hero-260909_big.jpg.large.jpg","apple-watch-ultra-3-black-black-alpine-loop-l":"/assets/products/watch-ultra3.png","iphone-16-pro-max":"https://www.apple.com/newsroom/images/2024/09/apple-debuts-iphone-16-pro-and-iphone-16-pro-max/article/Apple-iPhone-16-Pro-hero-240909_inline.jpg.large.jpg","imac-24-m3":"https://www.apple.com/newsroom/images/2023/10/apple-supercharges-24-inch-imac-with-new-m3-chip/article/Apple-iMac-M3-colors-231030_big.jpg.large.jpg","macbook-neo-13":"https://www.apple.com/newsroom/images/2026/03/macbook-neo-iphone-17e-ipad-air-with-m4-and-more-are-now-available/article/Apple-March-2026-MacBook-Neo-color-lineup_big.jpg.large.jpg","macbook-air-13-m5":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-macbook-air-with-m5/article/Apple-MacBook-Air-hero-260303_big.jpg.large.jpg","macbook-air-15-m5":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-macbook-air-with-m5/article/Apple-MacBook-Air-hero-260303_big.jpg.large.jpg","macbook-pro-14-m5":"https://www.apple.com/newsroom/images/2025/10/apple-unveils-new-14-inch-macbook-pro-powered-by-the-m5-chip/article/Apple-MacBook-Pro-14-in-front-251015_big.jpg.large.jpg","ipad-11-a16":"https://www.apple.com/v/ipad-11/d/images/overview/hero/hero__crzh9misvcuq_large.jpg","ipad-air-11-m4":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/article/Apple-iPad-Air-M4-multitasking-260302_big.jpg.large.jpg","ipad-air-13-m4":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/article/Apple-iPad-Air-M4-multitasking-260302_big.jpg.large.jpg","ipad-pro-11-m5":"https://www.apple.com/newsroom/images/2025/10/apple-introduces-the-powerful-new-ipad-pro-with-the-m5-chip/article/Apple-iPad-Pro-hero-251015_big.jpg.large.jpg","ipad-pro-13-m5":"https://www.apple.com/newsroom/images/2025/10/apple-introduces-the-powerful-new-ipad-pro-with-the-m5-chip/article/Apple-iPad-Pro-hero-251015_big.jpg.large.jpg"};
function addCard(key,variants){
 const p=variants.reduce((a,b)=>a.price<=b.price?a:b), groupedCard=!!p.groupKey;
 const card=document.createElement('article');card.className='catalog-item'+(groupedCard?' model-card':'');card.dataset.id=key;
 const photo=document.createElement('a');photo.className='model-photo';photo.href=targetUrl(p);photo.style.cssText='background:#fff;display:grid;place-items:center;text-decoration:none;overflow:hidden';
 if(photoMap[key]){const img=document.createElement('img');img.src=photoMap[key];img.alt=p.model;img.width=700;img.height=700;img.loading='eager';img.decoding='async';img.style.cssText='width:100%;height:100%;object-fit:contain';photo.appendChild(img);}else{const monogram=document.createElement('span');monogram.textContent=p.model.replace('Samsung Galaxy ','').replace('iPhone ','').slice(0,18);monogram.style.cssText='font-size:clamp(24px,4vw,42px);font-weight:800;color:#fff;text-align:center;padding:24px';photo.style.background='linear-gradient(145deg,#171217,#2e2029)';photo.appendChild(monogram);}
 const top=document.createElement('div');top.className='catalog-item-top';const brand=document.createElement('span');brand.textContent=p.category==='samsung'?'Samsung':p.category==='iphone'||p.category==='mac'||p.category==='ipad'||p.category==='watch'||p.category==='airpods'||p.category==='accessories'?'Apple':'А Маркет';top.appendChild(brand);
 const h=document.createElement('h2');h.textContent=groupedCard?p.model:p.name;
 const meta=document.createElement('p');meta.className='catalog-item-meta';meta.textContent=groupedCard?variants.length+' вариантов · Наличие уточняйте':p.meta;
 const bottom=document.createElement('div');bottom.className='catalog-item-bottom';const strong=document.createElement('strong');const buy=document.createElement('a');buy.className='catalog-buy';buy.href=targetUrl(p);buy.textContent=groupedCard?'Выбрать вариант ↗':'Уточнить наличие ↗';if(!p.page){buy.target='_blank';buy.rel='noopener noreferrer';}bottom.append(strong,buy);
 card.append(photo,top,h,meta,bottom);grid.appendChild(card);cards.set(key,card);
}
grouped.forEach((variants,key)=>{if(!cards.has(key))addCard(key,variants);});
const presentModels=new Set([...fields.model.options].map(o=>o.value));
[...new Set(products.map(p=>p.model))].sort((a,b)=>a.localeCompare(b,'ru')).forEach(model=>{if(!presentModels.has(model)){const o=document.createElement('option');o.value=model;o.textContent=model;fields.model.appendChild(o);}});
const modelOptions=[...fields.model.options];
const iphoneOrder=['iphone-18-pro-max','iphone-18-pro','iphone-17-pro-max','iphone-17-pro','iphone-air','iphone-17','iphone-17e','iphone-16-pro-max','iphone-16-pro','iphone-16','iphone-15'];
const iphoneCards=iphoneOrder.map(id=>cards.get(id)).filter(Boolean);
if(iphoneCards.length){const parent=iphoneCards[0].parentElement;iphoneCards.forEach(card=>parent.appendChild(card));const firstNonIphone=[...parent.children].find(card=>!iphoneOrder.includes(card.dataset.id));if(firstNonIphone)iphoneCards.forEach(card=>parent.insertBefore(card,firstNonIphone));}

let category=new URLSearchParams(location.search).get('category')||'';
if(!buttons.some(b=>b.dataset.category===category))category='';
function matching(p,filters){
const q=filters.query.toLocaleLowerCase('ru').trim();
const hasPrice=filters.min!==''||filters.max!=='';
return (!filters.category||p.category===filters.category)
&& (!filters.model||p.model===filters.model)
&& (!filters.memory||p.memory===Number(filters.memory))
&& (!q||p.name.toLocaleLowerCase('ru').includes(q))
&& (!hasPrice||(p.price!==null&&p.price>=(filters.min===''?0:Number(filters.min))&&p.price<=(filters.max===''?Infinity:Number(filters.max))));
}
function apply(){
const models=new Set(products.filter(p=>!category||p.category===category).map(p=>p.model));
modelOptions.forEach(o=>{o.hidden=!!o.value&&!models.has(o.value);o.disabled=o.hidden;});
if(fields.model.value&&!models.has(fields.model.value))fields.model.value='';
buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
const filters=Object.fromEntries(Object.entries(fields).map(([k,input])=>[k,input.value]));filters.category=category;
const invalid=filters.min!==''&&filters.max!==''&&Number(filters.min)>Number(filters.max);
document.querySelector('#range-error').hidden=!invalid;
let count=0;const matched=new Map();
products.forEach(p=>{if(!invalid&&matching(p,filters)){count++;const key=p.groupKey||p.id;if(!matched.has(key))matched.set(key,[]);matched.get(key).push(p);}});
cards.forEach((card,key)=>{const variants=matched.get(key);card.hidden=!variants;if(variants){const p=variants.reduce((a,b)=>a.price<=b.price?a:b),groupedCard=!!p.groupKey;card.querySelector('strong').textContent=(groupedCard?'от ':'')+new Intl.NumberFormat('ru-RU').format(p.price)+' ₽';card.querySelectorAll('a').forEach(a=>a.href=targetUrl(p));}});
document.querySelector('#catalog-count').textContent='Моделей и товаров: '+matched.size+' · Вариантов: '+count;
document.querySelector('#catalog-empty').hidden=count>0||invalid;
}
buttons.forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;apply();}));
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',apply);form.addEventListener('change',apply);
form.addEventListener('reset',()=>{category='';setTimeout(apply,0);});
document.querySelector('#empty-reset').addEventListener('click',()=>form.reset());
apply();
})();

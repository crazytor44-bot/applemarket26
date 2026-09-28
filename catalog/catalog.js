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
function addCard(key,variants){
 const p=variants.reduce((a,b)=>a.price<=b.price?a:b), groupedCard=!!p.groupKey;
 const card=document.createElement('article');card.className='catalog-item'+(groupedCard?' model-card':'');card.dataset.id=key;
 const photo=document.createElement('a');photo.className='model-photo';photo.href=targetUrl(p);photo.style.cssText='background:linear-gradient(145deg,#171217,#2e2029);display:grid;place-items:center;text-decoration:none';
 const monogram=document.createElement('span');monogram.textContent=p.model.replace('Samsung Galaxy ','').replace('iPhone ','').slice(0,18);monogram.style.cssText='font-size:clamp(24px,4vw,42px);font-weight:800;color:#fff;text-align:center;padding:24px';photo.appendChild(monogram);
 const top=document.createElement('div');top.className='catalog-item-top';const brand=document.createElement('span');brand.textContent=p.category==='samsung'?'Samsung':p.category==='iphone'||p.category==='watch'||p.category==='airpods'||p.category==='accessories'?'Apple':'А Маркет';top.appendChild(brand);
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

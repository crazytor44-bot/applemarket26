(() => {
const products=JSON.parse(document.querySelector('#catalog-data').textContent);
const form=document.querySelector('#catalog-filters');
const fields={query:document.querySelector('#catalog-query'),model:document.querySelector('#catalog-model'),memory:document.querySelector('#catalog-memory'),min:document.querySelector('#catalog-min'),max:document.querySelector('#catalog-max')};
const buttons=[...document.querySelectorAll('[data-category]')];
const cards=new Map([...document.querySelectorAll('.catalog-item')].map(card=>[card.dataset.id,card]));
const modelOptions=[...fields.model.options];
const iphoneOrder=['iphone-18-pro-max','iphone-18-pro','iphone-17-pro-max','iphone-17-pro','iphone-air','iphone-17','iphone-17e','iphone-16-pro','iphone-16','iphone-15'];
const iphoneCards=iphoneOrder.map(id=>cards.get(id)).filter(Boolean);
if(iphoneCards.length){const parent=iphoneCards[0].parentElement;const first=iphoneCards.reduce((a,b)=>[...parent.children].indexOf(a)<[...parent.children].indexOf(b)?a:b);iphoneCards.forEach(card=>parent.insertBefore(card,first));}

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
cards.forEach((card,key)=>{const variants=matched.get(key);card.hidden=!variants;if(variants&&variants[0].groupKey){const p=variants.reduce((a,b)=>a.price<=b.price?a:b);card.querySelector('strong').textContent='от '+new Intl.NumberFormat('ru-RU').format(p.price)+' ₽';card.querySelectorAll('a').forEach(a=>a.href=p.page+'?variant='+p.id);}});
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

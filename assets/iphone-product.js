(() => {
const data=JSON.parse(document.querySelector('#product-data').textContent), variants=data.variants;
const params=new URLSearchParams(location.search);
if(data.slug==='iphone-18-pro'&&params.get('model')==='max'){location.replace('/iphone-18-pro-max/'+location.search);return;}
const fields={memory:document.querySelector('#product-memory'),color:document.querySelector('#product-color'),region:document.querySelector('#product-region')};
const regions={'🇯🇵':'🇯🇵 Япония · eSIM','🇮🇳':'🇮🇳 Индия · SIM + eSIM','🇪🇺':'🇪🇺 Европа · SIM + eSIM','🇨🇳':'🇨🇳 Китай · SIM уточните','eSIM':'eSIM','1 SIM':'1 SIM'};
const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
let initial=variants.find(v=>v.id===params.get('variant'));
if(!initial&&variants[0].preorder){const colors=['Black','Burgundy','Silver','Blue'];initial=variants.find(v=>v.color===(colors[Number(params.get('color'))]||'Black')&&v.region===(params.get('sim')==='1'?'1 SIM':'eSIM'));}
initial=initial||variants[0];
function options(key,list,value){const select=fields[key];select.replaceChildren(...[...new Set(list.map(v=>String(v[key])))].map(val=>{const option=document.createElement('option');option.value=val;option.textContent=key==='memory'?(Number(val)>=1024?Number(val)/1024+' ТБ':val+' ГБ'):key==='region'?(regions[val]||val):val;return option;}));select.value=[...select.options].some(o=>o.value===String(value))?String(value):select.options[0].value;}
function render(){const p=variants.find(v=>String(v.memory)===fields.memory.value&&v.color===fields.color.value&&v.region===fields.region.value);document.querySelector('#price').textContent=money(p.price);document.querySelector('#selection').textContent=p.name;document.querySelector('#variant-status').textContent=p.preorder?'Предзаказ · Выдача 23–24 сентября':p.meta;document.querySelector('#order').href=p.preorder?'https://wa.me/79383119888?text='+encodeURIComponent('Здравствуйте! Хочу оформить предзаказ '+p.name+' за '+money(p.price)+'. Выдача 23–24 сентября.'):p.url;history.replaceState(null,'',location.pathname+'?variant='+encodeURIComponent(p.id));}
function cascade(){const color=fields.color.value,region=fields.region.value;const memory=variants.filter(v=>String(v.memory)===fields.memory.value);options('color',memory,color);options('region',memory.filter(v=>v.color===fields.color.value),region);render();}
options('memory',variants,initial.memory);options('color',variants.filter(v=>v.memory===initial.memory),initial.color);options('region',variants.filter(v=>v.memory===initial.memory&&v.color===initial.color),initial.region);
fields.memory.addEventListener('change',cascade);fields.color.addEventListener('change',cascade);fields.region.addEventListener('change',render);render();
})();

(() => {
const data=JSON.parse(document.querySelector('#product-data').textContent), variants=data.variants;
const images=JSON.parse(document.querySelector('#product-images')?.textContent||'{}');
const gallery=JSON.parse(document.querySelector('#product-gallery').textContent);let view='main';
const params=new URLSearchParams(location.search);
if(data.slug==='iphone-18-pro'&&params.get('model')==='max'){location.replace('/iphone-18-pro-max/'+location.search);return;}
const fields={memory:document.querySelector('#product-memory'),color:document.querySelector('#product-color'),region:document.querySelector('#product-region')};
const regions={'🇦🇪':'🇦🇪 ОАЭ','🇯🇵':'🇯🇵 Япония · eSIM','🇮🇳':'🇮🇳 Индия · SIM + eSIM','🇪🇺':'🇪🇺 Европа · SIM + eSIM','🇨🇳':'🇨🇳 Китай · SIM уточните','eSIM':'eSIM','1 SIM':'1 SIM'};
const colors={"Black":["Чёрный","#303033"],"Gray":["Серый титан","#8e8c83"],"SilverBlue":["Серебристо-голубой титан","#b7c4d5"],"WhiteSilver":["Серебристо-белый титан","#dddddb"],"IcyBlue":["Ледяной голубой","#c8d7df"],"Mint":["Мятный","#d1e2d4"],"Navy":["Тёмно-синий","#3c4966"],"Cobalt Violet":["Кобальтовый фиолетовый","#686884"],"PinkGold":["Розовое золото","#ead7ce"],"Silver Shadow":["Серебристый","#aeb1b4"],"Sky Blue":["Небесно-голубой","#b8cedf"],"White":["Белый","#f0f0ed"]};
if(/^iphone-17-pro/.test(data.slug))colors.Blue=['Тёмно-синий','#384557'];
const colorLabel=c=>(colors[c]||[c])[0];
const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
let initial=variants.find(v=>v.id===params.get('variant'));
if(!initial&&variants[0].preorder){const names=['Black','Burgundy','Silver','Blue'];initial=variants.find(v=>v.color===(names[Number(params.get('color'))]||'Black')&&v.region===(params.get('sim')==='1'?'1 SIM':'eSIM'));}
initial=initial||variants[0];
function options(key,list,value){const select=fields[key];select.replaceChildren(...[...new Set(list.map(v=>String(v[key])))].map(val=>{const option=document.createElement('option');option.value=val;option.textContent=key==='memory'?(Number(val)>=1024?Number(val)/1024+' ТБ':val+' ГБ'):key==='region'?(regions[val]||val):colorLabel(val);return option;}));select.value=[...select.options].some(o=>o.value===String(value))?String(value):select.options[0].value;}
const photo=document.querySelector('#product-photo'),caption=document.querySelector('#photo-caption'),swatches=document.querySelector('#color-swatches');
let photoVersion=0;
function showPhoto(p){
 if(!photo)return;
 const src=gallery[p.color]?.[view]||images[p.color],label=(data.model||p.model)+' — '+colorLabel(p.color);
 document.querySelector('#color-name').textContent=colorLabel(p.color);
 if(photo.dataset.color===p.color&&photo.dataset.view===view)return;
 photo.dataset.view=view;
 photo.dataset.color=p.color;const version=++photoVersion;
 photo.hidden=true;photo.alt=label;caption.textContent='Загружаем фото · '+colorLabel(p.color);
 if(!src){caption.textContent='Фото этого цвета уточните у продавца';return;}
 photo.onload=()=>{if(version!==photoVersion)return;photo.hidden=false;caption.textContent=label;};
 photo.onerror=()=>{if(version!==photoVersion)return;photo.hidden=true;caption.textContent='Фото не загрузилось. Выбран цвет: '+colorLabel(p.color);};
 photo.src=src;
 if(photo.complete&&photo.naturalWidth){photo.hidden=false;caption.textContent=label;}
}
function render(){const p=variants.find(v=>String(v.memory)===fields.memory.value&&v.color===fields.color.value&&v.region===fields.region.value);if(!p)return;document.querySelector('#price').textContent=money(p.price);document.querySelector('#selection').textContent=p.name;document.querySelector('#variant-status').textContent=p.preorder?'Предзаказ · Выдача 23–24 сентября':p.meta;document.querySelector('#order').href=p.preorder?'https://wa.me/79383119888?text='+encodeURIComponent('Здравствуйте! Хочу оформить предзаказ '+p.name+' за '+money(p.price)+'. Выдача 23–24 сентября.'):p.url;history.replaceState(null,'',location.pathname+'?variant='+encodeURIComponent(p.id));showPhoto(p);swatches?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===p.color)));}
function cascade(){const memory=fields.memory.value,region=fields.region.value;const matching=variants.filter(v=>v.color===fields.color.value);options('memory',matching,memory);options('region',matching.filter(v=>String(v.memory)===fields.memory.value),region);render();}
options('color',variants,initial.color);options('memory',variants.filter(v=>v.color===initial.color),initial.memory);options('region',variants.filter(v=>v.memory===initial.memory&&v.color===initial.color),initial.region);
if(swatches){for(const color of new Set(variants.map(v=>v.color))){const b=document.createElement('button');b.type='button';b.className='color-swatch';b.dataset.color=color;b.setAttribute('aria-pressed','false');const chip=document.createElement('span');chip.className='color-chip';chip.setAttribute('aria-hidden','true');chip.style.setProperty('--chip',(colors[color]||['','#aaa'])[1]);const text=document.createElement('span');text.textContent=colorLabel(color);b.append(chip,text);b.addEventListener('click',()=>{fields.color.value=color;cascade();});swatches.append(b);}}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
fields.memory.addEventListener('change',cascade);fields.color.addEventListener('change',cascade);fields.region.addEventListener('change',render);render();
})();

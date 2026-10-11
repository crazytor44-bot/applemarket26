const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {DOMParser}=require('linkedom');
const root=path.join(__dirname,'..');
const html='<html><body>'+
 '<div id="catalog-grid">'+
 '<article class="catalog-item model-card" data-id="iphone-18-pro">'+
 '<a class="model-photo" href="/iphone-18-pro/"><img src="/assets/models/iphone-18-pro.png"></a>'+
 '<h2>iPhone 18 Pro</h2></article>'+
 '<article class="catalog-item model-card" data-id="iphone-18-pro-max">'+
 '<a class="model-photo" href="/iphone-18-pro-max/"><img src="/assets/models/iphone-18-pro-max.png"></a>'+
 '<h2>iPhone 18 Pro Max</h2></article></div>'+
 '<script id="catalog-data" type="application/json">'+JSON.stringify([
 {id:'18a',groupKey:'iphone-18-pro',price:136000,available:true},
 {id:'18b',groupKey:'iphone-18-pro',price:125000,available:true},
 {id:'18c',groupKey:'iphone-18-pro-max',price:151000,available:true}
 ])+'</script></body></html>';
const doc=new DOMParser().parseFromString(html,'text/html');
let store={},lastFocus=null;
Object.defineProperty(doc,'activeElement',{configurable:true,get:()=>lastFocus});
const w=doc.defaultView;
w.HTMLElement.prototype.focus=function(){lastFocus=this;};
const windowMock={
 addEventListener(){},setTimeout,confirm:()=>true,alert:()=>{},
};
const localStorage={
 getItem:k=>store[k]||null,
 setItem:(k,v)=>{store[k]=v}
};
const context={document:doc,window:windowMock,localStorage,location:{pathname:'/catalog/'},
 fetch:()=>{throw Error('The inline catalog data should prevent fetch')},
 setTimeout,DOMParser,MutationObserver:undefined,Intl,Date,encodeURIComponent};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/favorites.js'),'utf8'),context);
const api=windowMock.AMarketFavorites;
assert(api,'Favorites API must initialize');
assert.equal(doc.querySelectorAll('.am-fav-heart').length,2,'Heart for each catalog model');
const cards=[...doc.querySelectorAll('.am-fav-heart')];
const click=el=>el.dispatchEvent(new w.Event('click',{bubbles:true,cancelable:true}));
click(cards[0]);
assert.equal(api.all().length,1);
assert.equal(cards[0].getAttribute('aria-pressed'),'true');
assert.equal(JSON.parse(store.amarket_favorites_v1)[0].key,'iphone-18-pro');
click(cards[1]);
assert.equal(api.all().length,2);
click(doc.querySelector('.am-fav-launch'));
assert(doc.querySelector('.am-fav-panel').classList.contains('open'),'Drawer must open');
(async()=>{
 await new Promise(r=>setTimeout(r,20));
 const titles=[...doc.querySelectorAll('.am-fav-row-info strong')].map(x=>x.textContent);
 assert.equal(titles.length,2);
 assert(doc.querySelector('.am-fav-list').textContent.includes('125 000')||doc.querySelector('.am-fav-list').textContent.includes('125 000'), 'Live price should use the lowest available group variant');
 const checkboxes=[...doc.querySelectorAll('.am-fav-select')];
 assert.equal(checkboxes.length,2);
 checkboxes.forEach(el=>{el.checked=true;el.dispatchEvent(new w.Event('change',{bubbles:true}));});
 const compare=doc.querySelector('.am-fav-compare');
 assert(!compare.hidden,'Two compatible favorites enable comparison');
 assert(compare.href.includes('kind=phones'));
 assert(compare.href.includes('left=iphone-18-pro-max'));
 assert(compare.href.includes('right=iphone-18-pro'));
 click(doc.querySelector('.am-fav-remove'));
 assert.equal(api.all().length,1,'Removed favorite must disappear from persisted list');
 click(doc.querySelector('.am-fav-clear'));
 assert.equal(api.all().length,0,'Clear button should clear list after confirmation');
 const pages=['index.html','catalog/index.html','choose/index.html','compare/index.html',
 'iphone-18-pro/index.html','iphone-17-pro-max/index.html','samsung-s26-ultra/index.html'];
 for(const page of pages){
  const src=fs.readFileSync(path.join(root,page),'utf8');
  assert(src.includes('/assets/favorites.css?v=amfav-v1-20261011'),page+' must load favorites styles');
  assert(src.includes('/assets/favorites.js?v=amfav-v1-20261011'),page+' must load favorites JavaScript');
 }
 console.log('PASS: favorites hearts, browser storage, current catalog price, comparisons, removal and page links');
})().catch(e=>{console.error(e);process.exitCode=1;});

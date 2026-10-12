const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {DOMParser}=require('linkedom');
const root=path.join(__dirname,'..');
const html='<html><body>'+
 '<header><div class="wrap"><a class="brand" href="/">А Маркет</a><a class="contact" href="/contacts/">Контакты</a></div></header>'+
 '<section class="catalog-page"><div class="catalog-intro"><div>А Маркет</div><h1 id="catalog-title">Найди свою технику</h1><p>Выберите вариант</p></div></section>'+
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

const opener=doc.querySelector('.am-fav-launch');
assert(opener,'Favorites opener remains available');
assert.equal(opener.parentElement.className,'am-fav-heading-row','Catalog opener must sit alongside title');
assert.equal(opener.previousElementSibling.id,'catalog-title','Opener must follow the title');
assert.equal(doc.querySelectorAll('.am-fav-launch').length,1,'Only one favorites opener');
assert(!doc.body.children.namedItem?.('am-fav-launch'),'No standalone floating opener at body root');

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
  assert(src.includes('/assets/favorites.css?v=amfav-header-v2-20261011'),page+' must load favorites styles');
  assert(src.includes('/assets/favorites.js?v=amfav-cartrow-20261012-1'),page+' must load favorites JavaScript');
 }
 const stylesheet=fs.readFileSync(path.join(root,'assets/favorites.css'),'utf8');
 assert(!/\\.am-fav-launch\\s*\\{\\s*position:fixed/.test(stylesheet),'Favorites launcher must not float over images');
 assert(stylesheet.includes('body.am-fav-locked #am-help'),'Help button must be hidden while favorites are open');
 assert(stylesheet.includes('body.am-fav-locked .am-cart-fab'),'Cart button must not overlap favorites drawer');
 // Detail pages keep an icon in the header and preserve product hearts.
 const detail=new DOMParser().parseFromString('<html><body><header><div class="wrap">'+
 '<a class="brand" href="/">А Маркет</a><a class="contact" href="/contacts/">Контакты</a>'+
 '</div></header><main><div class="product-layout"><div class="gallery">'+
 '<img id="product-photo" src="/assets/models/iphone-18-pro-max.png"></div>'+
 '<h1 id="product-title">iPhone 18 Pro Max</h1></div></main></body></html>','text/html');
 const secondWindow={addEventListener(){},setTimeout,confirm:()=>true,alert:()=>{}};
 const second={document:detail,window:secondWindow,location:{pathname:'/iphone-18-pro-max/'},localStorage,
  setTimeout,DOMParser,MutationObserver:undefined,Intl,Date,encodeURIComponent};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/favorites.js'),'utf8'),second);
 const detailOpener=detail.querySelector('.am-fav-launch');
 assert(detailOpener?.classList.contains('am-fav-launch--header'),'Detail favorites button must move to header');
 assert.equal(detailOpener.nextElementSibling?.className,'contact','Header favorite icon must precede contact link');
 assert.equal(detail.querySelectorAll('.gallery .am-fav-heart').length,1,'Detail page heart must still exist');
 console.log('PASS: favorites hearts, browser storage, current catalog price, comparisons, removal and page links');
})().catch(e=>{console.error(e);process.exitCode=1;});

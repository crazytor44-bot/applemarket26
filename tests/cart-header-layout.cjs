const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {DOMParser}=require('linkedom');
const root=path.join(__dirname,'..');
function initialize(html,pathname){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const store={};let focused=null;
 Object.defineProperty(doc,'activeElement',{configurable:true,get:()=>focused});
 doc.defaultView.HTMLElement.prototype.focus=function(){focused=this;};
 const win={confirm:()=>true,addEventListener(){},alert:()=>{},setTimeout};
 const localStorage={getItem:k=>store[k]||'[]',setItem:(k,v)=>{store[k]=v}};
 const context={document:doc,window:win,location:{pathname},localStorage,
  Intl,encodeURIComponent,setTimeout,MutationObserver:undefined,
  fetch:()=>Promise.reject(new Error('No network required'))};
 vm.runInNewContext(fs.readFileSync(root+'/assets/cart.js','utf8'),context);
 vm.runInNewContext(fs.readFileSync(root+'/assets/favorites.js','utf8'),context);
 return {doc,win,store};
}
const catalog=initialize('<html><body><header><div class="wrap">'+
 '<a class="brand" href="/">А Маркет</a><a class="contact" href="/contacts/">Контакты</a>'+
 '</div></header><main><section class="catalog-intro">'+
 '<h1>Найди свою технику</h1><p>Описание</p></section></main></body></html>','/catalog/');
const cat=catalog.doc;
const row=cat.querySelector('.catalog-intro .am-fav-heading-row');
assert(row,'Catalog has a common top heading row');
assert.equal(cat.querySelectorAll('.am-fav-heading-row').length,1,'No duplicate heading rows');
assert.equal(row.children[0].tagName,'H1','Heading stays first');
assert.equal(row.children[1].classList.contains('am-fav-launch--catalog'),true,'Favorites is beside title');
assert.equal(row.children[2].classList.contains('am-cart-fab--catalog'),true,'Cart is beside favorites');
assert.equal(cat.querySelectorAll('.am-cart-fab').length,1,'Exactly one cart opener');
assert(!Array.from(cat.body.children).includes(cat.querySelector('.am-cart-fab')),'Cart must not be floating in body');
catalog.win.AMarketCart.add({id:'sample',name:'Тест iPhone',price:25000,href:'/catalog/'});
assert.equal(cat.querySelector('.am-cart-count').textContent,'1','Cart count still updates');
assert.equal(cat.querySelector('.am-cart-panel').classList.contains('open'),true,'Adding to cart still opens drawer');
assert(cat.querySelector('.am-cart-total').textContent.includes('25'),'Cart totals are preserved');
const detail=initialize('<html><body><header><div class="wrap">'+
 '<a class="brand" href="/">А Маркет</a><a class="contact" href="/contacts/">Контакты</a>'+
 '</div></header><main><div class="product-layout"><div class="gallery">'+
 '<img id="product-photo" src="/p.png"></div><h1 id="product-title">iPhone 18 Pro Max</h1>'+
 '</div></main></body></html>','/iphone-18-pro-max/');
const header=detail.doc.querySelector('header .wrap');
assert.deepEqual(Array.from(header.children).map(x=>x.className),
 ['brand','am-fav-launch am-fav-launch--header','am-cart-fab am-cart-fab--header','contact'],
 'Compact favorites and cart controls should appear together in header');
const css=fs.readFileSync(root+'/assets/cart.css','utf8');
assert(css.includes('.am-cart-fab.am-cart-fab--header'),'CSS must explicitly override the floating cart button');
assert(css.includes('position:relative!important'),'Header cart must be in normal document flow');
assert(css.includes('left:auto!important;right:auto!important;top:auto!important;bottom:auto!important'),
 'Override historic bottom-left mobile !important rules');
assert(css.includes('.am-cart-panel.is-checkout.keyboard-open .am-cart-foot'),
 'Keep existing iOS keyboard checkout handling');
const pages=['index.html','catalog/index.html','choose/index.html',
 'iphone-18-pro/index.html','iphone-17-pro-max/index.html','samsung-s26-ultra/index.html'];
for(const p of pages){
 const src=fs.readFileSync(root+'/'+p,'utf8');
 assert(src.includes('/assets/cart.css?v=amcart-header-20261012-1'),p+' requires new layout CSS');
 assert(src.includes('/assets/cart.js?v=amcart-header-20261012-1'),p+' requires new cart script');
 assert(src.includes('/assets/favorites.js?v=amfav-cartrow-20261012-1'),p+' requires favorite compatibility');
}
console.log('PASS: inline cart, catalog title actions, header controls, badge and checkout');

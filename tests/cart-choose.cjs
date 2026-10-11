const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {DOMParser}=require('linkedom');
const root=path.join(__dirname,'..');
const products=[{id:'variant-a',name:'Телефон А 256 ГБ',price:19990},{id:'variant-b',name:'Телефон А 512 ГБ',price:23990}];
const html='<html><body><h1 id="choose-title">Телефон А</h1>'+
 '<select id="variant-select"><option value="variant-a">256 ГБ — 19 990 ₽</option><option value="variant-b">512 ГБ — 23 990 ₽</option></select>'+
 '<div id="choose-price">19 990 ₽</div><img id="choose-photo" src="/sample.png">'+
 '<a id="choose-order" href="https://wa.me/79383119888">Уточнить наличие</a>'+
 '<script id="choose-data" type="application/json">'+JSON.stringify({group:products})+'</script></body></html>';
const doc=new DOMParser().parseFromString(html,'text/html');
let saved='[]';
const ctx={document:doc,location:{pathname:'/choose/'},localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v},
 Intl,encodeURIComponent,alert:()=>{throw Error('Unexpected alert')},window:{confirm:()=>true},
 fetch:()=>Promise.reject(Error('No network required'))};
doc.querySelector('#variant-select').value='variant-a';
vm.runInNewContext(fs.readFileSync(root+'/assets/cart.js','utf8'),ctx);
const button=doc.querySelector('.am-choose-add');
assert(button,'Chooser must display Add to Cart button');
assert(doc.querySelector('.am-cart-fab'),'Cart drawer launcher must exist on chooser');
console.log('DEBUG CHOOSE',JSON.stringify({value:doc.querySelector('#variant-select').value,selectedIndex:doc.querySelector('#variant-select').selectedIndex,optionCount:doc.querySelector('#variant-select').options?.length,price:doc.querySelector('#choose-price').textContent}));
button.dispatchEvent(new doc.defaultView.Event('click',{bubbles:true}));
let items=JSON.parse(saved);
assert.equal(items.length,1);
assert.equal(items[0].id,'variant-a');
assert.equal(items[0].price,19990);
assert.equal(items[0].qty,1);
assert.equal(items[0].image,'/sample.png');
assert.equal(doc.querySelector('.am-cart-panel').classList.contains('open'),true);
doc.querySelector('#variant-select').value='variant-b';
doc.querySelector('#choose-price').textContent='23 990 ₽';
button.dispatchEvent(new doc.defaultView.Event('click',{bubbles:true}));
items=JSON.parse(saved);
assert.equal(items.length,2);
assert.equal(items[1].id,'variant-b');
assert.equal(items[1].price,23990);
assert.equal(items[1].name,'Телефон А 512 ГБ');
assert.equal(doc.querySelector('.am-cart-total').textContent.includes('43'),true);
console.log('PASS: chooser adds selected variants to premium cart and computes totals');

const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {DOMParser}=require('linkedom');
const root=path.join(__dirname,'..');
const doc=new DOMParser().parseFromString('<html><body></body></html>','text/html');
const events={},viewport={height:760,offsetTop:0,addEventListener(name,fn){events[name]=fn;}};
let active=null;
Object.defineProperty(doc,'activeElement',{configurable:true,get:()=>active});
let items=JSON.stringify([{id:'catalog-new0',name:'Тестовый iPhone',price:103000,qty:1}]);
const windowMock={
  innerWidth:390,innerHeight:760,visualViewport:viewport,
  matchMedia:()=>({matches:true}),addEventListener:()=>{},
  setTimeout:()=>0,confirm:()=>true
};
const ctx={
 document:doc,window:windowMock,location:{pathname:'/catalog/'},Intl,encodeURIComponent,
 localStorage:{getItem:()=>items,setItem:(k,v)=>{items=v;}},fetch:async()=>({ok:false}),
 alert:()=>{throw Error('Unexpected alert')}
};
vm.runInNewContext(fs.readFileSync(root+'/assets/cart.js','utf8'),ctx);
const panel=doc.querySelector('.am-cart-panel'),footer=doc.querySelector('.am-cart-foot');
assert(panel,'Cart must initialize');
doc.querySelector('.am-cart-next').onclick();
assert(panel.classList.contains('is-checkout'),'Checkout state should be marked on panel');
assert(!panel.classList.contains('keyboard-open'),'Footer stays visible before keyboard opens');
assert(!footer.hidden,'Checkout footer stays available until field is focused');
const input=doc.querySelector('#am-name');
active=input;
viewport.height=380;
events.resize();
assert(panel.classList.contains('keyboard-open'),'Keyboard must switch mobile checkout layout');
assert.equal(panel.style.getPropertyValue('--am-cart-visual-height'),'380px');
viewport.height=760;
events.resize();
assert(!panel.classList.contains('keyboard-open'),'Dismissed keyboard restores checkout footer');
doc.querySelector('.am-cart-back').onclick();
assert(!panel.classList.contains('is-checkout'),'Returning to cart clears checkout layout');
const css=fs.readFileSync(root+'/assets/cart.css','utf8');
assert(css.includes('.am-cart-panel.is-checkout.keyboard-open .am-cart-foot'));
assert(css.includes('display:none!important'));
console.log('PASS: iOS checkout compact keyboard layout, viewport restore and cart return');

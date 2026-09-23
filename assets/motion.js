(()=>{'use strict';
const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
if(preference.matches||!('IntersectionObserver' in window)||!Element.prototype.animate)return;
const active=new Set(),seen=new WeakSet();
const selector='.hero,.heading,.category,.product-card,.service,.review,.info-card,.info-image,.catalog-item,.color-gallery,.config,.trade-request,.compare-device';
const observer=new IntersectionObserver(entries=>{for(const entry of entries){const el=entry.target;if(!entry.isIntersecting||!entry.intersectionRect.width||!entry.intersectionRect.height)continue;observer.unobserve(el);if(seen.has(el)||preference.matches)continue;seen.add(el);if(el.contains(document.activeElement))continue;const animation=el.animate([{opacity:.35,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.2,.65,.3,1)'});active.add(animation);animation.finished.catch(()=>{}).finally(()=>active.delete(animation));}}, {threshold:0,rootMargin:'0px 0px -12px 0px'});
document.querySelectorAll(selector).forEach(el=>observer.observe(el));
function stop(){if(!preference.matches)return;observer.disconnect();for(const a of active)a.cancel();active.clear();}
if(preference.addEventListener)preference.addEventListener('change',stop);else preference.addListener(stop);
document.addEventListener('focusin',()=>{for(const a of active)a.cancel();active.clear();});
})();
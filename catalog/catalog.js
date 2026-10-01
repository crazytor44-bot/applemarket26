(() => {
const products=JSON.parse(document.querySelector('#catalog-data').textContent);
products.forEach(p=>{
 const key=p.groupKey||'';
 if(key==='iphone-air'){p.category='iphone';p.model='iPhone Air';}
 if(key==='samsung-watch-ultra'){p.category='samsung';p.model='Samsung Galaxy Watch Ultra 47';}
});
const accessoryRules=[
 [/^Magic Mouse 3\s+(.+)$/i,'Magic Mouse 3','accessories-magic-mouse-3'],
 [/^JBL Charge 5\s+(.+)$/i,'JBL Charge 5','accessories-jbl-charge-5'],
 [/^JBL Clip 4\s+(.+)$/i,'JBL Clip 4','accessories-jbl-clip-4'],
 [/^JBL Flip 6\s+(.+)$/i,'JBL Flip 6','accessories-jbl-flip-6'],
 [/^JBL Go 3\s+(.+)$/i,'JBL Go 3','accessories-jbl-go-3'],
 [/^Marshall Major 5\s+(.+)$/i,'Marshall Major 5','accessories-marshall-major-5'],
 [/^Станция Лайт 2 \(без часов\)\s+(.+)$/i,'Станция Лайт 2 (без часов)','accessories-станция-лайт-2-без-часов'],
 [/^Станция Лайт 2\s+(.+)$/i,'Станция Лайт 2','accessories-станция-лайт-2'],
 [/^Станция Макс с Zigbee\s+(.+)$/i,'Станция Макс с Zigbee','accessories-станция-макс-с-zigbee'],
 [/^Станция Миди\s+(.+)$/i,'Станция Миди','accessories-станция-миди'],
 [/^Станция Мини 3\s+(.+)$/i,'Станция Мини 3','accessories-станция-мини-3']
];
function normalizeAccessoryProduct(p){
 if(p.category!=='accessories')return;
 const oldKey=p.groupKey||p.id;
 for(const [re,model,groupKey] of accessoryRules){
  const match=(p.name||'').match(re);
  if(!match)continue;
  p._catalogOldKey=oldKey;p.model=model;p.groupKey=groupKey;p.page='/choose/';p.color=p.color||match[1].trim();return;
 }
 if(p.model==='Fitbit Air'){p.page='/choose/';p.color=p.color||(p.name||'').replace(/^Fitbit Air\s*/i,'').trim();}
}
products.forEach(normalizeAccessoryProduct);
const staleAccessoryKeys=new Set(products.filter(p=>p._catalogOldKey&&p._catalogOldKey!==p.groupKey).map(p=>p._catalogOldKey));
const form=document.querySelector('#catalog-filters');
const fields={query:document.querySelector('#catalog-query'),model:document.querySelector('#catalog-model'),memory:document.querySelector('#catalog-memory'),min:document.querySelector('#catalog-min'),max:document.querySelector('#catalog-max')};
const categoryLabels={iphone:'iPhone',samsung:'Samsung',xiaomi:'Xiaomi · Poco',honor:'Honor',mac:'Mac',ipad:'iPad',watch:'Apple Watch',airpods:'AirPods',beauty:'Красота',cameras:'Камеры',glasses:'Умные очки',gaming:'PlayStation',accessories:'Аксессуары',collectibles:'Коллекционное'};
const brandLabels={iphone:'Apple',samsung:'Samsung',xiaomi:'Xiaomi',honor:'Honor',mac:'Apple',ipad:'Apple',watch:'Apple',airpods:'Apple',beauty:'Dyson',cameras:'Фото и видео',glasses:'Умные очки',gaming:'PlayStation',accessories:'Аксессуары',collectibles:'Коллекционное'};
const categoryFieldset=document.querySelector('.catalog-categories');
const existingCategories=new Set([...document.querySelectorAll('[data-category]')].map(button=>button.dataset.category));
[...new Set(products.map(product=>product.category))].forEach(category=>{if(!existingCategories.has(category)){const button=document.createElement('button');button.type='button';button.className='choice';button.dataset.category=category;button.setAttribute('aria-pressed','false');button.textContent=categoryLabels[category]||category;categoryFieldset.appendChild(button);}});
const buttons=[...document.querySelectorAll('[data-category]')];
const grid=document.querySelector('#catalog-grid');
const cards=new Map([...document.querySelectorAll('.catalog-item')].map(card=>[card.dataset.id,card]));
staleAccessoryKeys.forEach(key=>{const card=cards.get(key);if(card){card.remove();cards.delete(key);}});
const grouped=new Map();
products.forEach(p=>{const key=p.groupKey||p.id;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(p);});
function targetUrl(p){if(p.page)return p.page+'?variant='+encodeURIComponent(p.id);if(p.category==='cameras')return '/choose/?variant='+encodeURIComponent(p.id)+'&v=cameras-chooser-20260930-2';if(p.category==='glasses')return '/choose/?variant='+encodeURIComponent(p.id)+'&v=glasses-chooser-20261001-2';if(p.category==='gaming')return '/choose/?variant='+encodeURIComponent(p.id)+'&v=gaming-chooser-20261001-2';if(p.category==='watch'||p.category==='airpods'||p.category==='beauty')return '/choose/?variant='+encodeURIComponent(p.id);return p.url;}
function variantLabel(count){const lastTwo=count%100,last=count%10;if(lastTwo>=11&&lastTwo<=14)return count+' вариантов';if(last===1)return count+' вариант';if(last>=2&&last<=4)return count+' варианта';return count+' вариантов';}
const photoMap={"samsung-a17":"https://images.samsung.com/is/image/samsung/p6pim/de/sm-a176bzkdeub/gallery/de-galaxy-a17-5g-sm-a176-sm-a176bzkdeub-548753932?$1164_776_PNG$=","samsung-a37":"https://images.samsung.com/is/image/samsung/p6pim/ru/sm-a376edgdcau/gallery/ru-galaxy-a37-5g-sm-a376-sm-a376edgdcau-551713449?$1164_776_PNG$=","samsung-a57":"https://images.samsung.com/is/image/samsung/assets/de/offer/galaxy-a57/carousel/260320_a57_multi_cutout_carousel_buypage_1600x864px.png?imbypass=true","samsung-z-flip-8":"https://img.global.news.samsung.com/uk/wp-content/uploads/2026/07/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-A-First-Look_main10.jpg","samsung-z-fold-8":"https://img.global.news.samsung.com/uk/wp-content/uploads/2026/07/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-A-First-Look_main6.jpg","samsung-z-fold-8-ultra":"https://img.global.news.samsung.com/uk/wp-content/uploads/2026/07/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-A-First-Look_main2.jpg","samsung-buds-4":"https://images.samsung.com/kdp/static/pd/buds/galaxy-buds4/SM-R540N_web_00_KV.jpg","samsung-buds-4-pro":"https://images.samsung.com/ru/galaxy-buds4-pro/feature/galaxy-buds4-pro-kv.jpg?imbypass=true","samsung-watch-ultra":"https://images.samsung.com/is/image/samsung/p6pim/ru/f2507/gallery/ru-galaxy-watch-ultra-2025-l705-sm-l705fzb1cau-547608533?$1164_776_PNG$=","airpods-5":"https://www.apple.com/newsroom/images/2026/09/apple-introduces-airpods-5-with-best-in-class-open-ear-active-noise-cancellation/article/Apple-AirPods-5-hero-260909_big.jpg.large.jpg","airpods-5-wireless":"https://www.apple.com/newsroom/images/2026/09/apple-introduces-airpods-5-with-best-in-class-open-ear-active-noise-cancellation/article/Apple-AirPods-5-hero-260909_big.jpg.large.jpg","apple-watch-ultra-3-black-black-alpine-loop-l":"https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-ultra-3-hero.png","iphone-16-pro-max":"https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/121032-iphone-16-pro-max.png","imac-24-m3":"https://www.apple.com/newsroom/images/2023/10/apple-supercharges-24-inch-imac-with-new-m3-chip/article/Apple-iMac-M3-colors-231030_big.jpg.large.jpg","macbook-neo-13":"https://www.apple.com/newsroom/images/2026/03/macbook-neo-iphone-17e-ipad-air-with-m4-and-more-are-now-available/article/Apple-March-2026-MacBook-Neo-color-lineup_big.jpg.large.jpg","macbook-air-13-m5":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-macbook-air-with-m5/article/Apple-MacBook-Air-hero-260303_big.jpg.large.jpg","macbook-air-15-m5":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-macbook-air-with-m5/article/Apple-MacBook-Air-hero-260303_big.jpg.large.jpg","macbook-pro-14-m5":"https://www.apple.com/newsroom/images/2025/10/apple-unveils-new-14-inch-macbook-pro-powered-by-the-m5-chip/article/Apple-MacBook-Pro-14-in-front-251015_big.jpg.large.jpg","ipad-11-a16":"https://www.apple.com/v/ipad-11/d/images/overview/hero/hero__crzh9misvcuq_large.jpg","ipad-air-11-m4":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/article/Apple-iPad-Air-M4-multitasking-260302_big.jpg.large.jpg","ipad-air-13-m4":"https://www.apple.com/newsroom/images/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/article/Apple-iPad-Air-M4-multitasking-260302_big.jpg.large.jpg","ipad-pro-11-m5":"https://www.apple.com/newsroom/images/2025/10/apple-introduces-the-powerful-new-ipad-pro-with-the-m5-chip/article/Apple-iPad-Pro-hero-251015_big.jpg.large.jpg","ipad-pro-13-m5":"https://www.apple.com/newsroom/images/2025/10/apple-introduces-the-powerful-new-ipad-pro-with-the-m5-chip/article/Apple-iPad-Pro-hero-251015_big.jpg.large.jpg"};
Object.assign(photoMap,{
 'xiaomi-note-15':'https://i02.appmifile.com/mi-com-product/fly-birds/redmi-note-15/pc/scroll_slider4.jpg',
 'xiaomi-note-17-pro-5g':'https://i02.appmifile.com/mi-com-product/fly-birds/redmi-note-17-pro-5g/pc/icon-screen04-slider-4.jpg',
 'xiaomi-note-17-pro-max-5g':'https://i02.appmifile.com/mi-com-product/fly-birds/redmi-note-17-pro-max-5g/pc/icon-screen05-slider-3.png',
 'xiaomi-poco-f8-ultra':'https://i02.appmifile.com/mi-com-product/fly-birds/poco-f8-ultra/pc/44ac18c72202e9cf733ddffedd198619.png',
 'xiaomi-poco-f9-pro':'https://i02.appmifile.com/mi-com-product/fly-birds/poco-f9-pro/pc/icon-screen39-1-1.png',
 'xiaomi-poco-f9-ultra':'https://i02.appmifile.com/mi-com-product/fly-birds/poco-f9-ultra/pc/icon-screen39-2.png',
 'xiaomi-poco-x8-pro':'https://i02.appmifile.com/mi-com-product/fly-birds/poco-x8-pro/pc/pc30_green_pic1.png?q=100',
 'xiaomi-mi-17t':'https://i02.appmifile.com/mi-com-product/fly-birds/xiaomi-17t/pc/dda2f4e1293aef781f3c577515f30019.jpg',
 'xiaomi-mi-17t-pro':'https://i02.appmifile.com/mi-com-product/fly-birds/xiaomi-17t-pro/pc/screen20-color-3.png',
 'xiaomi-mi-17-ultra':'https://i02.appmifile.com/mi-com-product/fly-birds/xiaomi-17-ultra/pc/489eb45a3fd47a6c3c09a0a94fa5bace.jpg?f=webp',
 'honor-honor-600-lite':'https://www.honor.com/content/dam/honor/common/products/honor-600-lite/imgs/green/section-kv/kv.avif',
 'honor-honor-600':'https://www.honor.com/content/dam/honor/common/products/honor-600/product/imgs/section-kv/honor600series-kv-bg.avif',
 'honor-honor-600-pro':'https://www.honor.com/content/dam/honor/common/products/honor-600-pro/product/imgs/section-kv/honor600series-kv-bg.avif',
 'beauty-dyson-ht01':'https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/hero-locale/en_GB/143346-01.png',
 'beauty-dyson-hs08':'https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/leap-petite-global/dynamic-media/personal-care/308f/primary/WEB-308F_H-AW-PDP-Primary-SW.png',
 'beauty-dyson-hs09':'https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary/264192-01.png',
 'cameras-canon-powershot-g7-x-mark-iii':'https://cdn.media.amplience.net/i/canon/g7_x_mark_iii_bk_frt_d39de1737aa145cfa5ab1c2f2fe7fa49?$flex-product-hero-1by1-jpg$=',
 'cameras-dji-mic-mini-2':'https://se-cdn.djiits.com/tpc/uploads/spu/cover/cc67a84b8908fc97d07e5d607d4679b3@ultra.png?format=webp',
 'cameras-dji-osmo-mobile-8':'https://se-cdn.djiits.com/tpc/uploads/carousel/image/8d9dff65bd56d551b4d3cbd814631919@ultra.webp',
 'cameras-dji-osmo-nano':'https://se-cdn.djiits.com/tpc/uploads/spu/cover/b1928694c545425a2ff219d8e267df0d@ultra.png?format=webp',
 'cameras-dji-osmo-pocket-4p':'https://se-cdn.djiits.com/tpc/uploads/carousel/image/d94b26866e0ca4fcd4b0a312eddbd9b4@ultra.jpg?format=webp',
 'cameras-fujifilm-instax-mini-13':'https://www.instax.com/mini13/assets/images/product_item_main_blue_front.png',
 'cameras-картриджи-instax-mini-photo-sticker-10-shots':'https://www.instax.com/mini_12/assets/images/pic_film_package.png',
 'cameras-картриджи-instax-mini-photo-sticker-20-shots':'https://www.instax.com/mini_12/assets/images/pic_film_package.png',
 'accessories-fitbit-air':'https://tsmactive.com/image/cache/catalog/_2026/Fitbit_AIR/google_fitbit_air_Fog_02-1100x1100.png',
 'glasses-starfire-kylie-jenner':'https://assets2.lenscrafters.com/prod-onecp-record-files/pieyewear/04fd31e8-0256-4189-9b97-b45200ea322a/0YM000006__1105A1__P21__shad__qt.png?impolicy=LC_grey',
 'glasses-rw4012':'https://images2.ray-ban.com/prod-onecp-record-files/pieyewear/ef902cf3-771e-450c-a436-b3a0002a78b6/0RW4012__6628MF__P21__shad__al31.png?impolicy=RB_Product_clone&width=1000&bgc=%23f2f2f2',
 'glasses-ai-glasses':'https://n.cdn.cdek.shopping/images/shopping/445f029b03484955a630e527e42f7ba6.jpg?v=1',
 'collectibles-labubu-zimomo':'https://avol.sg/cdn/shop/files/pop-mart-zimomo-the-monsters-i-found-pre-order-full-payment-177.jpg?v=1758748760&width=1445',
 'gaming-dualsense':'https://gmedia.playstation.com/is/image/SIEPDC/dualsense-controller-image-block-01-ps5-26jun20?$1600px$=',
 'gaming-dualsense-ps5':'https://gmedia.playstation.com/is/image/SIEPDC/dualsense-controller-image-block-01-ps5-26jun20?$1600px$=',
 'gaming-charging-station-dualsense':'https://store.sony.com.au/dw/image/v2/abbc_PRD/on/demandware.static/-/Sites-sony-master-catalog/default/dw1e282a80/images/PS5DSDOCKW/PS5DSDOCKW.png?sh=900&sm=fit&sw=900',
 'gaming-ps5-disc-drive':'https://media.direct.playstation.com/is/image/sierialto/Disc-Drive-PS5-Hero-1?$Background_Large$',
 'gaming-sony-pulse':'https://store.sony.com.au/dw/image/v2/abbc_PRD/on/demandware.static/-/Sites-sony-master-catalog/default/dwc903d3fe/images/PS5ELITEWIRELESSHS/PS5ELITEWIRELESSHS.png?sh=900&sm=fit&sw=900',
 'gaming-ps5-slim-digital':'https://gmedia.playstation.com/is/image/SIEPDC/ps5-slim-digital-edition-right-image-block-01-en-24jun24?$1600px--t$=',
 'gaming-ps5-slim':'https://gmedia.playstation.com/is/image/SIEPDC/ps5-slim-edition-left-image-block-01-en-24jun24?$1600px--t$=',
 'gaming-ps5-slim-ghost-of-yotei-limited-edition-gold':'https://gmedia.playstation.com/is/image/SIEPDC/Ghost-of-Yotei-LE-Gold-image-block-01-02jul25?$1600px--t$=',
 'gaming-ps5-pro-2-ревизия':'https://media.direct.playstation.com/is/image/sierialto/ps5-pro-Hero-2-forward-facing'
});
Object.assign(photoMap,{
 'ipad-pro-11-m4':'https://www.apple.com/newsroom/images/2024/05/apple-unveils-stunning-new-ipad-pro-with-m4-chip-and-apple-pencil-pro/article/Apple-iPad-Pro-hero-240507_big.jpg.large.jpg',
 'ipad-pro-13-m4':'https://www.apple.com/newsroom/images/2024/05/apple-unveils-stunning-new-ipad-pro-with-m4-chip-and-apple-pencil-pro/article/Apple-iPad-Pro-hero-240507_big.jpg.large.jpg',
 'watch-se2':'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-40-se-nc-alum-silver-sport-band-denim?wid=600&hei=600&fmt=jpeg&qlt=90',
 'watch-se3':'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-40-se-3-nc-alum-midnight-sport-band-midnight?wid=600&hei=600&fmt=jpeg&qlt=90',
 'watch-series-11':'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-42-s11-alum-jet-sport-band-black?wid=600&hei=600&fmt=jpeg&qlt=90',
 'watch-ultra-3':'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/apple-watch-ultra-3-hero.png',
 'airpods-airpods-4':'/assets/products/airpods-4.jpg',
 'airpods-airpods-5':photoMap['airpods-5'],
 'airpods-airpods-pro-3':'/assets/products/airpods-pro-3.jpg',
 'airpods-airpods-max-2024':'/assets/products/airpods-max-orange.jpg',
 'airpods-airpods-max-2':'/assets/products/airpods-max-blue.jpg',
 'accessories-airtag-1-pack':'/assets/products/airtag-1.jpg',
 'accessories-airtag-4-pack':'/assets/products/airtag-4.jpg',
 'accessories-airtag-2-4-pack':'/assets/products/airtag-2-4.jpg',
 'accessories-magic-trackpad-usbc-white':'/assets/products/trackpad-white.jpg',
 'accessories-magic-mouse-3-black':'/assets/products/mouse-black.jpg',
 'accessories-magic-mouse-3-white':'/assets/products/mouse-white.jpg',
 'accessories-pencil-pro':'/assets/products/pencil-pro.jpg',
 'accessories-pencil-usbc':'/assets/products/pencil-usbc.jpg',
 'accessories-power-adapter-20w-usbc-100-original':'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/MWVV3?wid=600&hei=600&fmt=jpeg&qlt=85',
 'accessories-magic-mouse-3':'/assets/products/mouse-white.jpg',
 'accessories-fitbit-air':'https://tsmactive.com/image/cache/catalog/_2026/Fitbit_AIR/google_fitbit_air_Fog_02-1100x1100.png',
 'accessories-jbl-charge-5':'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw8c55b4fe/JBL_CHARGE5_HERO_RED_0029_x2.png?sw=535&sh=535',
 'accessories-jbl-clip-4':'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw7abef79b/JBL_CLIP4_HERO_STANDARD_BLUE_0741_x1.png?sw=535&sh=535',
 'accessories-jbl-flip-6':'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwdd53473b/JBL_FLIP6_SQUAD_HERO_31828_x1.png?sw=535&sh=535',
 'accessories-jbl-go-3':'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw8b6740f7/JBL_GO_3_HERO_CLOUD_WHITE_0081_1605x1605px.png?sw=535&sh=535',
 'accessories-marshall-major-5':'https://images.ctfassets.net/javen7msabdh/6o4KYhq9D0w3SBbKU5aeZV/c53c73600937cf2c0830120e872d7a00/major-v-black-front-mobile-1.jpeg?w=1200&fm=jpg&q=85',
 'accessories-станция-лайт-2':'https://avatars.mds.yandex.net/get-iot/image-1761316455583-ymve0n0va-01.png_0/optimize',
 'accessories-станция-лайт-2-без-часов':'https://avatars.mds.yandex.net/get-iot/image-1761317129683-jjvcmye10-01.png_0/optimize',
 'accessories-станция-макс-с-zigbee':'https://avatars.mds.yandex.net/get-iot/image-1761318074307-ixa00ly96-01.png_0/optimize',
 'accessories-станция-миди':'https://avatars.mds.yandex.net/get-iot/image-1761318271312-21pgt34an-01.png_0/optimize',
 'accessories-станция-мини-3':'https://avatars.mds.yandex.net/get-iot/image-1761316807201-9lk9e40bg-01.png_0/optimize',
 'accessories-jbl-clip-5-squad':'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwfcbb770f/JBL_CLIP_5_HERO_CAMO_48148_x5.png?sw=535&sh=535',
 'accessories-станция-стрит-черная':'https://avatars.mds.yandex.net/get-iot/image-1761317581287-ynb8iwo3v-01.png_0/optimize'
});
const categoryPhotos={
 iphone:'/assets/models/iphone-17.png',samsung:photoMap['samsung-a17'],
 xiaomi:'https://i02.appmifile.com/855_operatorx_operatorx_opx/11/01/2024/4fad3c8039e37a4fa97f8be0462e88e5.png?q=85&thumb=1&w=500',
 honor:photoMap['samsung-a17'],mac:photoMap['macbook-air-13-m5'],ipad:photoMap['ipad-11-a16'],
 watch:'/assets/products/watch-se3.png',airpods:'/assets/products/airpods-4.jpg',
 beauty:photoMap['beauty-dyson-ht01'],cameras:'https://www.instax.com/mini_12/assets/images/pic_mini12_purple_01.png',
 glasses:photoMap['glasses-ai-glasses'],
 gaming:photoMap['gaming-ps5-slim'],accessories:'',
 collectibles:'https://prod-america-res.popmart.com/default/20260123_175743_055710____4_them-1_____1200x1200.JPG?x-oss-process=image%2Fresize%2Cw_1400%2Fquality%2Cq_90%2Fformat%2Cwebp'
};
const iphonePhotos=new Set(['iphone-15','iphone-16','iphone-16-pro','iphone-17e','iphone-17','iphone-air','iphone-17-pro','iphone-17-pro-max','iphone-18-pro','iphone-18-pro-max']);
function placeholderPhoto(p){const label=(categoryLabels[p.category]||p.model||'А Маркет').slice(0,22);return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8f4f6"/><stop offset="1" stop-color="#e6d9df"/></linearGradient></defs><rect width="700" height="700" rx="38" fill="url(#g)"/><circle cx="350" cy="285" r="118" fill="#8d3651" opacity=".12"/><path d="M270 360h160a28 28 0 0 1 28 28v36H242v-36a28 28 0 0 1 28-28Z" fill="#8d3651" opacity=".2"/><text x="350" y="520" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="700" fill="#4b303a">${label}</text></svg>`);}
function productPhoto(p,key){if(photoMap[key])return photoMap[key];if(iphonePhotos.has(key))return `/assets/models/${key}.png`;return categoryPhotos[p.category]||placeholderPhoto(p);}
function fitCardPhoto(card,p,key,replace){
 const photo=card.querySelector('.model-photo'),img=photo&&photo.querySelector('img');if(!img)return;
 const original=img.getAttribute('src');if(replace){const resolved=photoMap[key]||(p.category==='accessories'?placeholderPhoto(p):'');if(resolved)img.src=resolved;}
 img.alt='Фото '+p.model;img.width=700;img.height=700;img.loading='lazy';img.decoding='async';
 photo.style.cssText+=';background:#fff;display:grid;place-items:center;overflow:hidden;padding:20px;box-sizing:border-box';
 img.style.cssText='width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center;display:block';
 if(replace)img.addEventListener('error',()=>{img.src=original||categoryPhotos[p.category]||'/assets/amarket-hero-burgundy.webp';},{once:true});
}
function pickVariant(variants){const available=variants.filter(p=>p.available!==false);const pool=available.length?available:variants;return pool.reduce((a,b)=>a.price<=b.price?a:b);}
function addCard(key,variants){
 const p=pickVariant(variants), groupedCard=!!p.groupKey, available=variants.some(v=>v.available!==false);
 const card=document.createElement('article');card.className='catalog-item'+(groupedCard?' model-card':'');card.dataset.id=key;
 const photo=document.createElement('a');photo.className='model-photo';photo.href=targetUrl(p);photo.style.cssText='background:#fff;display:grid;place-items:center;text-decoration:none;overflow:hidden;padding:20px;box-sizing:border-box';
 const img=document.createElement('img');img.src=productPhoto(p,key);img.alt='Фото '+p.model;img.width=700;img.height=700;img.loading='lazy';img.decoding='async';img.style.cssText='width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center;display:block';img.addEventListener('error',()=>{img.src=categoryPhotos[p.category]||'/assets/amarket-hero-burgundy.webp';},{once:true});photo.appendChild(img);
 const top=document.createElement('div');top.className='catalog-item-top';const brand=document.createElement('span');brand.textContent=brandLabels[p.category]||'А Маркет';top.appendChild(brand);
 const h=document.createElement('h2');h.textContent=groupedCard?p.model:p.name;
 const meta=document.createElement('p');meta.className='catalog-item-meta';meta.textContent=available?(groupedCard?variantLabel(variants.length)+' · Наличие уточняйте':p.meta):'Нет в наличии';
 const bottom=document.createElement('div');bottom.className='catalog-item-bottom';const strong=document.createElement('strong');const buy=document.createElement('a');buy.className='catalog-buy';buy.href=targetUrl(p);buy.textContent=available?(groupedCard?'Выбрать вариант ↗':'Уточнить наличие ↗'):'Уточнить поступление ↗';if(/^https?:\/\//.test(buy.href)&&!buy.href.startsWith(location.origin)){buy.target='_blank';buy.rel='noopener noreferrer';}bottom.append(strong,buy);card.classList.toggle('is-unavailable',!available);
 card.append(photo,top,h,meta,bottom);grid.appendChild(card);cards.set(key,card);
}
grouped.forEach((variants,key)=>{
 const existed=cards.has(key);if(!existed)addCard(key,variants);
 const p=pickVariant(variants),card=cards.get(key);fitCardPhoto(card,p,key,existed&&(!!photoMap[key]||p.category==='accessories'));
 if(card&&p.category==='accessories'&&p.page==='/choose/'){
  const href=targetUrl(p),photo=card.querySelector('.model-photo'),buy=card.querySelector('.catalog-buy'),title=card.querySelector('h2'),meta=card.querySelector('.catalog-item-meta');
  if(photo){photo.href=href;photo.removeAttribute('target');photo.removeAttribute('rel');}
  if(buy){buy.href=href;buy.removeAttribute('target');buy.removeAttribute('rel');buy.textContent='Выбрать вариант ↗';}
  if(title)title.textContent=p.model;
  if(meta)meta.textContent=variantLabel(variants.length)+' · Наличие уточняйте';
 }
});
const presentModels=new Set([...fields.model.options].map(o=>o.value));
[...new Set(products.map(p=>p.model))].sort((a,b)=>a.localeCompare(b,'ru')).forEach(model=>{if(!presentModels.has(model)){const o=document.createElement('option');o.value=model;o.textContent=model;fields.model.appendChild(o);}});
const modelOptions=[...fields.model.options];
const iphoneOrder=['iphone-18-pro-max','iphone-18-pro','iphone-17-pro-max','iphone-17-pro','iphone-air','iphone-17','iphone-17e','iphone-16-pro-max','iphone-16-pro','iphone-16','iphone-15'];
const iphoneCards=iphoneOrder.map(id=>cards.get(id)).filter(Boolean);
if(iphoneCards.length){const parent=iphoneCards[0].parentElement;iphoneCards.forEach(card=>parent.appendChild(card));const firstNonIphone=[...parent.children].find(card=>!iphoneOrder.includes(card.dataset.id));if(firstNonIphone)iphoneCards.forEach(card=>parent.insertBefore(card,firstNonIphone));}

const params=new URLSearchParams(location.search);
let category=params.get('category')||(params.get('q')?'':'iphone');
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
cards.forEach((card,key)=>{const variants=matched.get(key);card.hidden=!variants;if(variants){const p=pickVariant(variants),groupedCard=!!p.groupKey,available=variants.some(v=>v.available!==false);card.classList.toggle('is-unavailable',!available);card.querySelector('strong').textContent=available?(groupedCard?'от ':'')+new Intl.NumberFormat('ru-RU').format(p.price)+' ₽':'Нет в наличии';const meta=card.querySelector('.catalog-item-meta');if(meta&&!available)meta.textContent='Нет в наличии';const buy=card.querySelector('.catalog-buy');if(buy)buy.textContent=available?(groupedCard?'Выбрать вариант ↗':'Уточнить наличие ↗'):'Уточнить поступление ↗';card.querySelectorAll('a').forEach(a=>{const href=targetUrl(p);a.href=href;if(href.startsWith('/')){a.removeAttribute('target');a.removeAttribute('rel');}else{a.target='_blank';a.rel='noopener noreferrer';}});}});
document.querySelector('#catalog-count').textContent='Моделей и товаров: '+matched.size+' · Вариантов: '+count;
document.querySelector('#catalog-empty').hidden=count>0||invalid;
}
buttons.forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;apply();}));
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',apply);form.addEventListener('change',apply);
form.addEventListener('reset',()=>{category='iphone';setTimeout(apply,0);});
document.querySelector('#empty-reset').addEventListener('click',()=>form.reset());
apply();
})();

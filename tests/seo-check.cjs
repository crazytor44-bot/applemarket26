// Static SEO smoke checks. Do not fetch live prices or change catalog data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const domain = 'https://applemarket26.ru';
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sitemap = read('sitemap.xml');
const robots = read('robots.txt');
assert(robots.includes('Sitemap: ' + domain + '/sitemap.xml'), 'robots.txt must advertise sitemap');
for (const prefix of ['/admin/', '/orders-admin/', '/preview/']) {
  assert(robots.includes('Disallow: ' + prefix), 'Robots must exclude ' + prefix);
}
const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), m => m[1]);
assert(urls.length >= 24, 'Sitemap should contain all existing public pages');
assert.equal(new Set(urls).size, urls.length, 'Sitemap cannot contain duplicate URLs');

const catalog = read('catalog/index.html');
assert(catalog.includes('id="catalog-model-links"'), 'Catalog should expose static navigation to model pages');
const titles = new Set();
let checkedModels = 0;
for (const url of urls) {
  assert(url.startsWith(domain + '/'), 'Sitemap should contain only first-party HTTPS URLs: ' + url);
  const pathname = new URL(url).pathname;
  assert(pathname.endsWith('/'), 'Prefer trailing-slash canonical URLs');
  const filepath = path.join(root, pathname.slice(1), 'index.html');
  assert(fs.existsSync(filepath), 'Sitemap entry points to missing page: ' + pathname);
  const html = fs.readFileSync(filepath, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]+)"/i)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  assert(title && title.length >= 18, 'Missing/short title: ' + pathname);
  assert(desc && desc.length >= 50, 'Missing/short description: ' + pathname);
  assert.equal(canonical, url, 'Canonical must match sitemap: ' + pathname);
  assert(!titles.has(title), 'Duplicate page title: ' + title);
  titles.add(title);

  if (/^\/(iphone|samsung)-[^/]+\/$/.test(pathname)) {
    checkedModels++;
    assert(title.includes('в Ставрополе'), 'Missing local purchase intent: ' + pathname);
    assert(desc.includes('Ставрополе'), 'Missing local description: ' + pathname);
    const raw = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/i)?.[1];
    assert(raw, 'Missing structured breadcrumbs: ' + pathname);
    const data = JSON.parse(raw);
    assert.equal(data['@type'], 'BreadcrumbList');
    assert.equal(data.itemListElement.at(-1).item, url);
    assert(html.includes('id="model-information"'), 'Missing static model info: ' + pathname);
    assert(catalog.includes('href="' + pathname + '"'), 'Missing direct canonical model link from catalog: ' + pathname);
    assert(/<h2\b[^>]*>Купить [^<]+ в Ставрополе<\/h2>/i.test(html), 'Missing model purchase heading: ' + pathname);
    assert(/href="\/(?:iphone|samsung)-[^/?]+\/"/.test(html), 'Missing clean related-model links: ' + pathname);
    assert(!html.includes('Тухачевского, 16к10'), 'Inconsistent store address: ' + pathname);
  }
}
assert.equal(checkedModels, 15, 'Expected 15 optimized iPhone and Samsung model pages');
const home = read('index.html');
for (const model of ['iphone-17-pro', 'iphone-17-pro-max', 'iphone-18-pro', 'iphone-18-pro-max']) {
  assert(home.includes('href="/' + model + '/"'), 'Missing direct model link from homepage: ' + model);
}
for (const pathname of ['index.html', 'contacts/index.html']) {
  const html = read(pathname);
  const schemas = Array.from(html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g), m => JSON.parse(m[1]));
  const shop = schemas.find(x => x['@type'] === 'ElectronicsStore');
  assert(shop, 'Missing local business schema on ' + pathname);
  assert.equal(shop.telephone, '+7-938-311-98-88');
}
assert(/<meta name="robots" content="noindex,follow">/.test(read('choose/index.html')), 'Generic chooser should not be indexed');
console.log('PASS: ' + urls.length + ' sitemap pages, ' + checkedModels + ' locally optimized models, schema, robots and canonicals');

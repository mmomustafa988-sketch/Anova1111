const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/data/animeDatabase.ts'), 'utf8');

// Parse items
const items = [];
const itemRegex = /\{\s*id:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"][\s\S]*?poster:\s*['"]([^'"]+)['"][\s\S]*?banner:\s*['"]([^'"]+)['"]/g;

let match;
while ((match = itemRegex.exec(content)) !== null) {
  items.push({
    id: match[1],
    title: match[2],
    poster: match[3],
    banner: match[4]
  });
}

console.log(`Found ${items.length} items in animeDatabase.ts`);

async function checkAll() {
  const broken = [];
  for (const item of items) {
    let pOk = false;
    let bOk = false;
    try {
      const res = await fetch(item.poster, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
      pOk = res.ok;
      if (!res.ok) console.log(`[POSTER FAIL] ${item.title} -> ${res.status}: ${item.poster}`);
    } catch (e) {
      console.log(`[POSTER ERR] ${item.title} -> ${e.message}: ${item.poster}`);
    }

    try {
      const res2 = await fetch(item.banner, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
      bOk = res2.ok;
      if (!res2.ok) console.log(`[BANNER FAIL] ${item.title} -> ${res2.status}: ${item.banner}`);
    } catch (e) {
      console.log(`[BANNER ERR] ${item.title} -> ${e.message}: ${item.banner}`);
    }

    if (!pOk || !bOk) {
      broken.push({ ...item, pOk, bOk });
    }
  }

  console.log(`\nResults: ${items.length - broken.length} fully OK, ${broken.length} with broken images.`);
  fs.writeFileSync(path.join(__dirname, '../broken_images.json'), JSON.stringify(broken, null, 2));
}

checkAll();

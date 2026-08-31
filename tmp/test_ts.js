async function testPagination() {
  const testPages = [1, 2, 5, 10, 20, 40, 60, 75, 80, 100];
  for (const page of testPages) {
    try {
      const u = `https://toon-stream.site/series/page/${page}/`;
      const res = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(6000)
      });
      console.log(`Page ${page}: Status ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        const cardCount = (text.match(/<article/gi) || []).length;
        console.log(`  Card count: ${cardCount}`);
        // match pagination links
        const matches = text.match(/page\/(\d+)/g);
        if (matches) {
          const numbers = matches.map(m => parseInt(m.replace('page/', ''), 10)).filter(n => !isNaN(n));
          const maxNum = Math.max(...numbers);
          console.log(`  Max page found in links: ${maxNum}`);
        }
      }
    } catch(e) {
      console.log(`Page ${page}: Error ${e.message}`);
    }
  }
}
testPagination();

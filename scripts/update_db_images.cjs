const fs = require('fs');
const path = require('path');

const verified = JSON.parse(fs.readFileSync(path.join(__dirname, '../master_verified_images.json'), 'utf8'));
let content = fs.readFileSync(path.join(__dirname, '../src/data/animeDatabase.ts'), 'utf8');

let updatedCount = 0;
for (const [title, v] of Object.entries(verified)) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the anime entry containing title
  const regex = new RegExp(`(title:\\s*["']${escaped}["'][\\s\\S]*?)(poster:\\s*["'][^"']+["'])([\\s\\S]*?)(banner:\\s*["'][^"']+["'])`, 'i');
  
  if (regex.test(content)) {
    content = content.replace(regex, (match, p1, p2, p3, p4) => {
      updatedCount++;
      return `${p1}poster: "${v.poster}"${p3}banner: "${v.banner}"`;
    });
  } else {
    // Try reversed order (poster before title)
    const regex2 = new RegExp(`(poster:\\s*["'][^"']+["'][\\s\\S]*?)(banner:\\s*["'][^"']+["'][\\s\\S]*?)(title:\\s*["']${escaped}["'])`, 'i');
    if (regex2.test(content)) {
      content = content.replace(regex2, (match, p1, p2, p3) => {
        updatedCount++;
        return `poster: "${v.poster}",\n    banner: "${v.banner}",\n    ${p3}`;
      });
    }
  }
}

fs.writeFileSync(path.join(__dirname, '../src/data/animeDatabase.ts'), content, 'utf8');
console.log(`Successfully updated ${updatedCount} entries in animeDatabase.ts!`);

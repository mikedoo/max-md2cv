import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, 'src', 'assets', 'templates');

fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.css')) return;
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');

  // Remove var() function wrapping
  c = c.replace(/var\(\s*--cv-[a-zA-Z0-9-]+\s*,\s*([^)]+)\)/g, '$1');

  // Convert rem to px
  c = c.replace(/([\d.]+)rem/g, (m, n) => {
    return (parseFloat(n) * 16) + 'px';
  });

  fs.writeFileSync(p, c);
});
console.log('done');

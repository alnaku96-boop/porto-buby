// Builds public/og.png (1200x630 link-preview card) from content.json. Run: npm run og
// ponytail: rendered locally and committed, because Vercel's build image has no reliable fonts for SVG text.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const c = JSON.parse(readFileSync('content.json', 'utf8'));
const { name, role, valueProposition, photo } = c.profile;
const award = c.experience.find((e) => e.award);
const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function wrap(text, max) {
  const lines = [''];
  for (const w of text.split(' ')) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  return lines;
}

const W = 1200, H = 630, PHOTO = 300, PX = 820, PY = 165;
const vp = wrap(valueProposition, 46).slice(0, 4);
const font = "font-family=\"Segoe UI, Inter, Arial, sans-serif\"";

const grid = Array.from({ length: 22 }, (_, i) => `<path d="M${i * 56} 0V${H}M0 ${i * 56}H${W}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g" cx="0.78" cy="0.45" r="0.55"><stop offset="0" stop-color="#00d992" stop-opacity="0.22"/><stop offset="1" stop-color="#00d992" stop-opacity="0"/></radialGradient>
    <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#101010"/><stop offset="0.55" stop-color="#101010" stop-opacity="0.6"/><stop offset="1" stop-color="#101010" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#101010"/>
  <g stroke="#3d3a39" stroke-width="1" opacity="0.45">${grid}</g>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="0" y="0" width="${W}" height="8" fill="#00d992"/>
  <text x="80" y="150" ${font} font-size="24" font-weight="600" letter-spacing="4" fill="#00d992">${esc(role.toUpperCase())}</text>
  <text x="80" y="235" ${font} font-size="68" font-weight="700" fill="#ffffff">${esc(name)}</text>
  ${vp.map((l, i) => `<text x="80" y="${310 + i * 44}" ${font} font-size="30" fill="#bdbdbd">${esc(l)}</text>`).join('')}
  ${award ? `<g transform="translate(80 470)"><rect width="${(award.award.length + award.company.length + 3) * 12 + 66}" height="56" rx="28" fill="#00d992" fill-opacity="0.1" stroke="#00d992" stroke-opacity="0.5"/><circle cx="30" cy="28" r="6" fill="#00d992"/><text x="50" y="37" ${font} font-size="24" font-weight="600" fill="#00d992">${esc(`${award.award} · ${award.company}`)}</text></g>` : ''}
  <rect x="${PX + 22}" y="${PY + 22}" width="${PHOTO}" height="${PHOTO}" rx="22" fill="none" stroke="#00d992" stroke-opacity="0.5" stroke-width="2"/>
  <rect x="${PX - 8}" y="${PY - 8}" width="${PHOTO + 16}" height="${PHOTO + 16}" rx="22" fill="#101010" stroke="#3d3a39" stroke-width="2"/>
</svg>`;

const layers = [];
if (photo) {
  const mask = Buffer.from(`<svg width="${PHOTO}" height="${PHOTO}"><rect width="${PHOTO}" height="${PHOTO}" rx="16" fill="#fff"/></svg>`);
  const img = await sharp(`public${photo}`).resize(PHOTO, PHOTO, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  layers.push({ input: img, left: PX, top: PY });
}
await sharp(Buffer.from(svg)).composite(layers).png().toFile('public/og.png');
console.log('Wrote public/og.png');

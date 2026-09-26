// Synthetic fixture for local upload/export checks; no remote image is used.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const dir = path.join(__dirname, 'artifacts');
fs.mkdirSync(dir, { recursive: true });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#e8d6bd"/><ellipse cx="400" cy="650" rx="230" ry="40" fill="#c4a480"/><path d="M245 245H535V465Q535 600 390 600Q245 600 245 465Z" fill="#ad754b"/><ellipse cx="390" cy="245" rx="145" ry="28" fill="#d2a980"/><path d="M535 300C710 265 710 500 530 465" fill="none" stroke="#ad754b" stroke-width="45"/><text x="400" y="110" text-anchor="middle" font-family="Arial" font-size="34" fill="#594534">PRODUCTO DE PRUEBA</text></svg>';
sharp(Buffer.from(svg)).png().toFile(path.join(dir, 'product-test.png')).then(() => console.log(path.join(dir, 'product-test.png')));

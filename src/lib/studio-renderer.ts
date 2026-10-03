import { Design, formats } from './studio';

const photo = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('No se pudo cargar una imagen del diseño.')); img.src = src;
});
function lines(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (ctx.measureText(word).width > width) {
        if (line) { result.push(line); line = ''; }
        for (const character of word) {
          if (ctx.measureText(line + character).width > width) { result.push(line); line = ''; }
          line += character;
        }
      } else if (line && ctx.measureText(line + ' ' + word).width > width) { result.push(line); line = word; }
      else line += (line ? ' ' : '') + word;
    }
    if (line) result.push(line);
  }
  return result;
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, height: number, size: number, font: string, color: string, bold = false) {
  let rows: string[] = [];
  do { ctx.font = `${bold ? '700' : '400'} ${size}px ${font}`; rows = lines(ctx, value, width); if (rows.length * size * 1.15 <= height) break; size -= 1; } while (size > 8);
  ctx.fillStyle = color; ctx.textBaseline = 'top'; rows.forEach((row, i) => ctx.fillText(row, x, y + i * size * 1.15));
}
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number, fit: 'contain' | 'cover') {
  const scale = (fit === 'cover' ? Math.max : Math.min)(width / img.width, height / img.height);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, width, height, 22); ctx.clip();
  ctx.drawImage(img, x + (width - img.width * scale) / 2, y + (height - img.height * scale) / 2, img.width * scale, img.height * scale); ctx.restore();
}
async function renderSocialLayout(ctx: CanvasRenderingContext2D, d: Design, img: HTMLImageElement, w: number, h: number, font: string) {
  const ink = contrast(d.background);
  const pad = w * 0.07;
  ctx.fillStyle = d.background; ctx.fillRect(0, 0, w, h);

  if (d.format === 'facebook') {
    const photoWidth = w * 0.56;
    cover(ctx, img, 0, 0, photoWidth, h, 'cover');
    ctx.fillStyle = d.background; ctx.fillRect(photoWidth, 0, w - photoWidth, h);
    const x = photoWidth + w * 0.055;
    const textWidth = w - x - w * 0.055;
    text(ctx, d.brand.name || 'Mi negocio', x, h * 0.08, textWidth, h * 0.07, Math.min(34, h * 0.055), font, d.color, true);
    text(ctx, d.title || d.product, x, h * 0.22, textWidth, h * 0.2, Math.min(54, h * 0.085), font, ink, true);
    text(ctx, d.body, x, h * 0.47, textWidth, h * 0.17, Math.min(25, h * 0.04), font, ink);
    text(ctx, [d.price, d.validity].filter(Boolean).join(' · '), x, h * 0.68, textWidth, h * 0.08, Math.min(27, h * 0.043), font, ink, true);
    const by = h * 0.81, bh = h * 0.1;
    ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(x, by, textWidth, bh, 14); ctx.fill();
    text(ctx, [d.cta, d.contact].filter(Boolean).join(' · '), x + 16, by + bh * 0.22, textWidth - 32, bh * 0.56, Math.min(24, bh * 0.42), font, contrast(d.color), true);
    return;
  }

  const base = '#FFF3F4';
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#A8F0BE'; ctx.beginPath(); ctx.ellipse(-w * 0.03, -h * 0.01, w * 0.36, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#A8F0BE'; ctx.beginPath(); ctx.ellipse(w * 1.03, h * 1.02, w * 0.3, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#D9D2CE'; ctx.beginPath(); ctx.ellipse(w * 0.16, h * 0.25, w * 0.1, h * 0.045, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 0.86, h * 0.72, w * 0.09, h * 0.04, 0.3, 0, Math.PI * 2); ctx.fill();

  const displayFont = 'Georgia, serif';
  text(ctx, d.brand.name || 'Mi negocio', w * 0.08, h * 0.045, w * 0.84, h * 0.035, Math.min(25, h * 0.022), font, ink, true);
  text(ctx, d.product || d.title, w * 0.09, h * 0.095, w * 0.82, h * 0.08, Math.min(56, h * 0.05), displayFont, ink, true);

  const productX = w * 0.27; const productY = h * 0.22; const productW = w * 0.46; const productH = h * (d.format === 'story' || d.format === 'whatsapp' ? 0.38 : 0.47);
  cover(ctx, img, productX, productY, productW, productH, 'contain');
  const arrow = (x: number, y: number, targetX: number, targetY: number, right = false) => {
    ctx.strokeStyle = '#A88D88'; ctx.lineWidth = Math.max(2, w * 0.002); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + targetX) / 2, y + (targetY - y) * 0.18, targetX, targetY); ctx.stroke();
    const angle = Math.atan2(targetY - y, targetX - x); const size = Math.max(9, w * 0.012);
    ctx.beginPath(); ctx.moveTo(targetX, targetY); ctx.lineTo(targetX - size * Math.cos(angle - 0.5), targetY - size * Math.sin(angle - 0.5)); ctx.lineTo(targetX - size * Math.cos(angle + 0.5), targetY - size * Math.sin(angle + 0.5)); ctx.closePath(); ctx.fillStyle = '#A88D88'; ctx.fill();
  };
  const note = (value: string, x: number, y: number, width: number, targetX: number, targetY: number, right = false) => {
    text(ctx, value, x, y, width, h * 0.12, Math.min(29, h * 0.026), displayFont, ink, true);
    arrow(right ? x : x + width, y + h * 0.07, targetX, targetY, right);
  };
  note(d.description || d.body, w * 0.045, h * 0.30, w * 0.23, productX, productY + productH * 0.25);
  note(d.body, w * 0.72, h * 0.30, w * 0.23, productX + productW, productY + productH * 0.27, true);
  note(d.price ? `Precio: ${d.price}` : 'Consulta el precio', w * 0.045, h * 0.61, w * 0.23, productX, productY + productH * 0.75);
  note(d.validity || 'Disponible ahora', w * 0.72, h * 0.61, w * 0.23, productX + productW, productY + productH * 0.75, true);

  const ctaY = h * 0.84; const ctaHeight = Math.max(58, h * 0.065);
  ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(w * 0.1, ctaY, w * 0.8, ctaHeight, 18); ctx.fill();
  text(ctx, [d.cta, d.contact].filter(Boolean).join('  ·  '), w * 0.14, ctaY + ctaHeight * 0.22, w * 0.72, ctaHeight * 0.54, Math.min(32, ctaHeight * 0.43), font, contrast(d.color), true);
  text(ctx, [d.brand.instagram, d.brand.facebook, d.brand.address].filter(Boolean).join('  ·  '), w * 0.1, h * 0.95, w * 0.8, h * 0.025, Math.min(21, h * 0.018), font, ink);
}
export function contrast(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#142e2c' : '#ffffff';
}
export async function renderDesign(d: Design, generatedImageUrl?: string | null): Promise<HTMLCanvasElement> {
  const { width: w, height: h } = formats[d.format];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No se pudo crear la vista previa.');
  const font = d.font === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif';
  const ink = contrast(d.background);
  ctx.fillStyle = d.background; ctx.fillRect(0, 0, w, h);
  const source = d.images[d.selectedImage] || d.images[0] || generatedImageUrl;
  if (source) {
    const image = await photo(source);
    await renderSocialLayout(ctx, d, image, w, h, font);
    return canvas;
  }
  if (d.style === 'Vibrante') { ctx.fillStyle = d.color; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(w, 0, w * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = d.color; ctx.fillRect(0, 0, w, h * 0.12);
  let brandX = w * 0.06;
  if (d.brand.logo) { const logo = await photo(d.brand.logo); const box = h * 0.075; const scale = Math.min(box / logo.width, box / logo.height); ctx.drawImage(logo, brandX, h * 0.025, logo.width * scale, logo.height * scale); brandX += box + 18; }
  text(ctx, d.brand.name || 'Mi negocio', brandX, h * 0.035, w * 0.82 - brandX, h * 0.055, Math.min(38, h * 0.05), font, contrast(d.color), true);
  if (source) { const img = await photo(source); cover(ctx, img, w * d.imageX / 100, h * d.imageY / 100, w * d.imageWidth / 100, h * 0.40, d.imageFit || 'contain'); }
  const x = w * d.textX / 100, y = h * d.textY / 100, tw = w * (0.94 - d.textX / 100);
  const remaining = h * 0.93 - y;
  text(ctx, d.title || d.product, x, y, tw, remaining * 0.31, d.textSize, font, ink, true);
  text(ctx, d.body, x, y + remaining * 0.34, tw, remaining * 0.24, Math.min(32, h * 0.03), font, ink);
  text(ctx, [d.price, d.validity].filter(Boolean).join(' · '), x, y + remaining * 0.61, tw, remaining * 0.12, Math.min(36, h * 0.031), font, ink, true);
  const by = y + remaining * 0.77, bh = remaining * 0.21;
  ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(x, by, tw, bh, 12); ctx.fill();
  text(ctx, [d.cta, d.contact].filter(Boolean).join(' · '), x + 18, by + bh * 0.2, tw - 36, bh * 0.62, Math.min(30, bh * 0.5), font, contrast(d.color), true);
  text(ctx, [d.brand.instagram, d.brand.facebook, d.brand.address].filter(Boolean).join('  ·  '), w * 0.07, h * 0.955, w * 0.86, h * 0.03, Math.min(22, h * 0.023), font, ink);
  return canvas;
}
export const pngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo exportar la imagen.')), 'image/png'));
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

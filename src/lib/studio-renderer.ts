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
export function contrast(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#142e2c' : '#ffffff';
}
export async function renderDesign(d: Design): Promise<HTMLCanvasElement> {
  const { width: w, height: h } = formats[d.format];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No se pudo crear la vista previa.');
  const font = d.font === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif';
  const ink = contrast(d.background);
  ctx.fillStyle = d.background; ctx.fillRect(0, 0, w, h);
  if (d.style === 'Vibrante') { ctx.fillStyle = d.color; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(w, 0, w * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = d.color; ctx.fillRect(0, 0, w, h * 0.12);
  let brandX = w * 0.06;
  if (d.brand.logo) { const logo = await photo(d.brand.logo); const box = h * 0.075; const scale = Math.min(box / logo.width, box / logo.height); ctx.drawImage(logo, brandX, h * 0.025, logo.width * scale, logo.height * scale); brandX += box + 18; }
  text(ctx, d.brand.name || 'Mi negocio', brandX, h * 0.035, w * 0.82 - brandX, h * 0.055, Math.min(38, h * 0.05), font, contrast(d.color), true);
  const source = d.images[d.selectedImage] || d.images[0];
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

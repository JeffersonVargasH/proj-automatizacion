import { Design, formats } from './studio';

const photo = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => {
    if (src.startsWith('http')) {
      fetch(src)
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const fallback = new Image();
          fallback.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(fallback);
          };
          fallback.onerror = () => reject(new Error('No se pudo cargar una imagen del diseño.'));
          fallback.src = blobUrl;
        })
        .catch(() => reject(new Error('No se pudo cargar una imagen del diseño.')));
      return;
    }
    reject(new Error('No se pudo cargar una imagen del diseño.'));
  };
  img.src = src;
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

async function drawBrandBadge(
  ctx: CanvasRenderingContext2D,
  logoSrc: string | undefined,
  brandName: string,
  x: number,
  y: number,
  maxH: number,
  theme: 'light' | 'dark' = 'light',
  font: string = 'Arial, sans-serif'
): Promise<number> {
  const isDark = theme === 'dark';
  let logoImg: HTMLImageElement | null = null;
  if (logoSrc) {
    try {
      logoImg = await photo(logoSrc);
    } catch {
      logoImg = null;
    }
  }

  const padY = Math.max(8, maxH * 0.12);
  const padX = Math.max(14, maxH * 0.22);
  const contentH = maxH - padY * 2;
  let logoW = 0;
  if (logoImg) {
    const scale = Math.min(contentH / logoImg.height, (maxH * 2.2) / logoImg.width);
    logoW = logoImg.width * scale;
  }

  const nameText = brandName || (logoImg ? '' : 'Mi negocio');
  ctx.font = `700 ${Math.round(contentH * 0.44)}px ${font}`;
  const textW = nameText ? ctx.measureText(nameText).width : 0;
  const gap = logoImg && nameText ? Math.round(maxH * 0.16) : 0;
  const totalW = padX * 2 + logoW + gap + textW;

  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.20)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;

  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ctx.roundRect(x, y, totalW, maxH, maxH / 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  let curX = x + padX;
  if (logoImg) {
    const scale = Math.min(contentH / logoImg.height, (maxH * 2.2) / logoImg.width);
    const drawW = logoImg.width * scale;
    const drawH = logoImg.height * scale;
    const drawY = y + (maxH - drawH) / 2;
    ctx.drawImage(logoImg, curX, drawY, drawW, drawH);
    curX += drawW + gap;
  }

  if (nameText) {
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(contentH * 0.44)}px ${font}`;
    ctx.fillText(nameText, curX, y + maxH / 2);
  }

  ctx.restore();
  return totalW;
}

async function renderAIFlyerLayout(
  ctx: CanvasRenderingContext2D,
  d: Design,
  aiImg: HTMLImageElement,
  w: number,
  h: number,
  font: string
) {
  const ink = contrast(d.background);

  if (d.format === 'whatsapp' || d.format === 'story') {
    // 1080 x 1920 (9:16 Vertical WhatsApp Business Status / Story)
    // 1. Ambient Background Fill
    ctx.save();
    cover(ctx, aiImg, 0, 0, w, h, 'cover');
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(11, 16, 30, 0.92)');
    bgGrad.addColorStop(0.2, 'rgba(11, 16, 30, 0.78)');
    bgGrad.addColorStop(0.65, 'rgba(15, 23, 42, 0.75)');
    bgGrad.addColorStop(0.82, 'rgba(11, 16, 30, 0.90)');
    bgGrad.addColorStop(1, 'rgba(11, 16, 30, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 2. Story Header (Top Brand Identity)
    await drawBrandBadge(ctx, d.brand.logo, d.brand.name, 48, 64, 82, 'light', font);

    const statusPillW = 260;
    const statusPillX = w - 48 - statusPillW;
    ctx.save();
    ctx.fillStyle = 'rgba(37, 211, 102, 0.16)';
    ctx.strokeStyle = 'rgba(37, 211, 102, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(statusPillX, 64, statusPillW, 82, 41);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#25D366';
    ctx.font = `700 24px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('WhatsApp Business', statusPillX + statusPillW / 2, 64 + 41);
    ctx.restore();

    // 3. Center Hero Card (The Square AI Flyer)
    const cardW = 984;
    const cardH = 984;
    const cardX = (w - cardW) / 2;
    const cardY = 200;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 32);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 32);
    ctx.clip();
    ctx.drawImage(aiImg, cardX, cardY, cardW, cardH);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 32);
    ctx.stroke();
    ctx.restore();

    // 4. Bottom WhatsApp Action Section
    const actionY = cardY + cardH + 36;
    const actionH = h - actionY - 54;
    const actionW = cardW;
    const actionX = cardX;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.roundRect(actionX, actionY, actionW, actionH, 28);
    ctx.fill();
    ctx.restore();

    text(ctx, d.title || d.product, actionX + 44, actionY + 36, actionW - 88, 80, 42, font, '#0f172a', true);
    text(ctx, d.body || d.description, actionX + 44, actionY + 124, actionW - 88, 90, 26, font, '#475569');

    const details = [d.price ? 'Precio: ' + d.price : '', d.validity ? 'Válido: ' + d.validity : ''].filter(Boolean).join('   ·   ');
    if (details) {
      text(ctx, details, actionX + 44, actionY + 225, actionW - 88, 44, 28, font, '#0f172a', true);
    }

    const btnY = actionY + actionH - 170;
    const btnH = 88;
    const btnW = actionW - 88;
    const btnX = actionX + 44;

    ctx.save();
    ctx.fillStyle = '#25D366';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 22);
    ctx.fill();

    const btnText = (d.cta ? d.cta.toUpperCase() : 'PEDIR POR WHATSAPP') + (d.brand.phone || d.contact ? '  ·  ' + (d.brand.phone || d.contact) : '');
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 30px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💬  ' + btnText, btnX + btnW / 2, btnY + btnH / 2);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.font = `500 20px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('Responde a este estado de WhatsApp para hacer tu pedido', actionX + actionW / 2, actionY + actionH - 42);
    ctx.restore();
    return;
  }

  if (d.format === 'facebook') {
    // 1200 x 630 (Landscape Facebook Feed Banner)
    ctx.fillStyle = d.background;
    ctx.fillRect(0, 0, w, h);

    const cardSize = 570;
    const cardX = 30;
    const cardY = 30;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardSize, cardSize, 22);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardSize, cardSize, 22);
    ctx.clip();
    ctx.drawImage(aiImg, cardX, cardY, cardSize, cardSize);
    ctx.restore();

    const rightX = 635;
    const rightW = w - rightX - 35;

    await drawBrandBadge(ctx, d.brand.logo, d.brand.name, rightX, 36, 62, ink === '#ffffff' ? 'dark' : 'light', font);

    text(ctx, d.title || d.product, rightX, 118, rightW, 110, 44, font, ink, true);
    text(ctx, d.body || d.description, rightX, 238, rightW, 80, 24, font, ink);

    const promo = [d.price ? 'Precio: ' + d.price : '', d.validity ? 'Válido: ' + d.validity : ''].filter(Boolean).join('  ·  ');
    if (promo) {
      text(ctx, promo, rightX, 328, rightW, 40, 26, font, ink, true);
    }

    const ctaY = 380;
    const ctaH = 70;
    ctx.save();
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.roundRect(rightX, ctaY, rightW, ctaH, 16);
    ctx.fill();
    ctx.restore();

    text(ctx, [d.cta || 'Haz tu pedido', d.contact || d.brand.phone].filter(Boolean).join('  ·  '), rightX + 24, ctaY + 22, rightW - 48, 36, 26, font, contrast(d.color), true);
    text(ctx, [d.brand.facebook, d.brand.instagram, d.brand.address].filter(Boolean).join('  ·  '), rightX, 480, rightW, 30, 20, font, ink);
    return;
  }

  // Instagram (1080 x 1080 Square)
  ctx.drawImage(aiImg, 0, 0, w, h);
  await drawBrandBadge(ctx, d.brand.logo, d.brand.name, 48, 48, 76, 'light', font);
}

async function renderSocialLayout(ctx: CanvasRenderingContext2D, d: Design, img: HTMLImageElement, w: number, h: number, font: string) {
  const ink = contrast(d.background);
  ctx.fillStyle = d.background; ctx.fillRect(0, 0, w, h);

  if (d.format === 'facebook') {
    const photoWidth = w * 0.56;
    cover(ctx, img, 0, 0, photoWidth, h, 'cover');
    ctx.fillStyle = d.background; ctx.fillRect(photoWidth, 0, w - photoWidth, h);
    const x = photoWidth + w * 0.055;
    const textWidth = w - x - w * 0.055;

    await drawBrandBadge(ctx, d.brand.logo, d.brand.name, x, h * 0.05, Math.min(54, h * 0.09), ink === '#ffffff' ? 'dark' : 'light', font);

    text(ctx, d.title || d.product, x, h * 0.18, textWidth, h * 0.2, Math.min(54, h * 0.085), font, ink, true);
    text(ctx, d.body, x, h * 0.44, textWidth, h * 0.17, Math.min(25, h * 0.04), font, ink);
    text(ctx, [d.price, d.validity].filter(Boolean).join(' · '), x, h * 0.66, textWidth, h * 0.08, Math.min(27, h * 0.043), font, ink, true);
    const by = h * 0.80, bh = h * 0.1;
    ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(x, by, textWidth, bh, 14); ctx.fill();
    text(ctx, [d.cta, d.contact].filter(Boolean).join(' · '), x + 16, by + bh * 0.22, textWidth - 32, bh * 0.56, Math.min(24, bh * 0.42), font, contrast(d.color), true);
    return;
  }

  // Decoraciones derivadas de los colores de la marca
  ctx.globalAlpha = d.style === 'Minimalista' ? 0.12 : 0.32;
  ctx.fillStyle = d.color; ctx.beginPath(); ctx.ellipse(-w * 0.03, -h * 0.01, w * 0.36, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 1.03, h * 1.02, w * 0.3, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(w * 0.16, h * 0.25, w * 0.1, h * 0.045, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 0.86, h * 0.72, w * 0.09, h * 0.04, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  const accent = ink === '#ffffff' ? 'rgba(255,255,255,.6)' : 'rgba(20,46,44,.45)';

  const displayFont = d.font === 'serif' ? 'Georgia, serif' : font;

  await drawBrandBadge(ctx, d.brand.logo, d.brand.name, w * 0.08, h * 0.035, Math.min(54, h * 0.048), ink === '#ffffff' ? 'dark' : 'light', font);

  text(ctx, d.product || d.title, w * 0.09, h * 0.095, w * 0.82, h * 0.08, Math.min(56, h * 0.05), displayFont, ink, true);

  const productX = w * 0.27; const productY = h * 0.22; const productW = w * 0.46; const productH = h * (d.format === 'story' || d.format === 'whatsapp' ? 0.38 : 0.47);
  cover(ctx, img, productX, productY, productW, productH, 'contain');
  const arrow = (x: number, y: number, targetX: number, targetY: number, right = false) => {
    ctx.strokeStyle = accent; ctx.lineWidth = Math.max(2, w * 0.002); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + targetX) / 2, y + (targetY - y) * 0.18, targetX, targetY); ctx.stroke();
    const angle = Math.atan2(targetY - y, targetX - x); const size = Math.max(9, w * 0.012);
    ctx.beginPath(); ctx.moveTo(targetX, targetY); ctx.lineTo(targetX - size * Math.cos(angle - 0.5), targetY - size * Math.sin(angle - 0.5)); ctx.lineTo(targetX - size * Math.cos(angle + 0.5), targetY - size * Math.sin(angle + 0.5)); ctx.closePath(); ctx.fillStyle = accent; ctx.fill();
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

export async function renderDesign(d: Design, generatedImageUrl?: string | null): Promise<HTMLCanvasElement> {
  const { width: w, height: h } = formats[d.format];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No se pudo crear la vista previa.');
  const font = d.font === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif';

  // 1. If an AI image was generated, render the tailored AI flyer layout with brand logo and safe margins
  if (generatedImageUrl) {
    const aiImage = await photo(generatedImageUrl);
    await renderAIFlyerLayout(ctx, d, aiImage, w, h, font);
    return canvas;
  }

  // 2. If the user provided product photos, render the editable editorial layout with brand logo
  const source = d.images[d.selectedImage] || d.images[0];
  if (source) {
    const image = await photo(source);
    await renderSocialLayout(ctx, d, image, w, h, font);
    return canvas;
  }

  // 3. Fallback layout when no image is uploaded
  const ink = contrast(d.background);
  ctx.fillStyle = d.background; ctx.fillRect(0, 0, w, h);
  if (d.style === 'Vibrante') { ctx.fillStyle = d.color; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(w, 0, w * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = d.color; ctx.fillRect(0, 0, w, h * 0.12);

  await drawBrandBadge(ctx, d.brand.logo, d.brand.name, w * 0.06, h * 0.025, h * 0.075, 'dark', font);

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

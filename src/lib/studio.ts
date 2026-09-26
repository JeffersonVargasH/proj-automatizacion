export const formats = {
  instagram: { label: 'Instagram · cuadrado', width: 1080, height: 1080 },
  portrait: { label: 'Instagram · vertical', width: 1080, height: 1350 },
  story: { label: 'Historia · Instagram / Facebook', width: 1080, height: 1920 },
  facebook: { label: 'Facebook · horizontal', width: 1200, height: 630 },
  whatsapp: { label: 'WhatsApp · estado', width: 1080, height: 1920 },
} as const;
export type Format = keyof typeof formats;
export const contentTypes = ['Flyer', 'Publicación', 'Historia', 'Oferta', 'Invitación'];
export const objectives = ['Vender', 'Anunciar un producto', 'Promocionar una oferta', 'Atraer visitas', 'Informar', 'Invitar a un evento'];
export const tones = ['Cercano', 'Profesional', 'Juvenil', 'Elegante', 'Divertido'];
export type Brand = { name: string; logo: string; primary: string; secondary: string; phone: string; instagram: string; facebook: string; address: string };
export const emptyBrand: Brand = { name: '', logo: '', primary: '#115e59', secondary: '#f4ede2', phone: '', instagram: '', facebook: '', address: '' };
export type Design = {
  id: string; createdAt: string; updatedAt: string; brand: Brand;
  type: string; objective: string; product: string; description: string;
  price: string; validity: string; contact: string; images: string[]; selectedImage: number; imageFit?: 'contain' | 'cover';
  format: Format; style: string; tone: string; instructions: string;
  title: string; body: string; cta: string; hashtags: string; caption: string;
  color: string; background: string; font: 'sans' | 'serif';
  textX: number; textY: number; textSize: number; imageX: number; imageY: number; imageWidth: number;
  requests: { id: string; text: string; createdAt: string; status: 'pending' }[];
  schedule: { channel: string; at: string; status: 'pending_connection' } | null;
};
export function newDesign(brand: Brand): Design {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, brand: { ...brand }, type: 'Flyer', objective: 'Vender', product: '', description: '', price: '', validity: '', contact: brand.phone, images: [], selectedImage: 0, format: 'instagram', style: 'Moderno', tone: 'Cercano', instructions: '', title: '', body: '', cta: 'Escríbenos', hashtags: '', caption: '', color: brand.primary, background: brand.secondary, font: 'sans', textX: 7, textY: 62, textSize: 68, imageX: 7, imageY: 16, imageWidth: 86, requests: [], schedule: null };
}
export function duplicateDesign(design: Design): Design {
  const now = new Date().toISOString();
  return { ...design, id: crypto.randomUUID(), createdAt: now, updatedAt: now, title: design.title + ' · copia', requests: [], schedule: null };
}
export function suggestCopy(d: Design, variant = 0) {
  const names = [d.product, `Descubre ${d.product}`, `${d.product}, para ti`];
  const offer = d.objective === 'Promocionar una oferta';
  const title = offer ? `${variant % 2 ? 'Una oferta para ti' : 'Dale un gusto a tu día'}` : names[variant % names.length];
  const endings: Record<string, string> = { Cercano: 'Conoce más y conversemos.', Profesional: 'Consulta los detalles y realiza tu pedido.', Juvenil: '¡Descúbrelo y compártelo!', Elegante: 'Un detalle que hace la diferencia.', Divertido: '¡Tu próximo favorito te espera!' };
  const body = `${d.description || d.product}. ${endings[d.tone] || endings.Cercano}`.slice(0, 180);
  const cta = d.objective === 'Atraer visitas' ? 'Visítanos' : d.objective === 'Invitar a un evento' ? 'Reserva tu lugar' : d.objective === 'Informar' ? 'Conoce más' : 'Haz tu pedido';
  const tag = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '');
  const hashtags = Array.from(new Set([tag(d.brand.name), tag(d.product), 'Emprendimiento'].filter(Boolean))).map(t => '#' + t).join(' ');
  return { title: title.slice(0, 80), body, cta, hashtags, caption: `${title}\n\n${body}${d.price ? '\nPrecio: ' + d.price : ''}${d.validity ? '\n' + d.validity : ''}${d.contact ? '\nContacto: ' + d.contact : ''}\n\n${cta}\n${hashtags}` };
}
export function generationPayload(d: Design) {
  return { version: 1, requestId: d.id, business: d.brand, product: { name: d.product, description: d.description, price: d.price, images: d.images }, content: { type: d.type, objective: d.objective, format: d.format, dimensions: formats[d.format], style: d.style, tone: d.tone, instructions: d.instructions, validity: d.validity, contact: d.contact }, copy: { title: d.title, body: d.body, cta: d.cta, hashtags: d.hashtags, caption: d.caption }, edits: d.requests, schedule: d.schedule };
}

export const formats = {
  instagram: { label: 'Instagram · cuadrado', width: 1080, height: 1080 },
  portrait: { label: 'Instagram · vertical', width: 1080, height: 1350 },
  story: { label: 'Historia · Instagram / Facebook', width: 1080, height: 1920 },
  facebook: { label: 'Facebook · horizontal', width: 1200, height: 630 },
  whatsapp: { label: 'WhatsApp · estado', width: 1080, height: 1920 },
} as const;
export type Format = keyof typeof formats;
// Cada publicación se genera en las tres redes; la clave de red coincide con su formato.
export const networks = {
  instagram: { label: 'Instagram', account: 'Cuenta profesional de Instagram' },
  facebook: { label: 'Facebook', account: 'Página de Facebook' },
  whatsapp: { label: 'WhatsApp Business', account: 'Número de WhatsApp Business' },
} as const;
export type Network = keyof typeof networks & Format;
export const outputs = Object.keys(networks) as Network[];
// Una intención reemplaza la doble elección de tipo y objetivo; ambos se siguen enviando en el contrato.
export const intents = [
  { label: 'Vender un producto', type: 'Publicación', objective: 'Vender' },
  { label: 'Anunciar una novedad', type: 'Publicación', objective: 'Anunciar un producto' },
  { label: 'Promocionar una oferta', type: 'Oferta', objective: 'Promocionar una oferta' },
  { label: 'Invitar a un evento', type: 'Invitación', objective: 'Invitar a un evento' },
  { label: 'Atraer visitas', type: 'Flyer', objective: 'Atraer visitas' },
  { label: 'Informar', type: 'Flyer', objective: 'Informar' },
] as const;
export const tones = ['Cercano', 'Profesional', 'Juvenil', 'Elegante', 'Divertido'];
export const styles = ['Moderno', 'Vibrante', 'Minimalista'];
export type Preferences = { tone: string; style: string; hashtags: string; instructions: string };
/** Las credenciales de Meta viven en n8n; aquí solo se guarda qué cuenta usar y si se publica al generar. */
export type Connection = { enabled: boolean; account: string };
export type Brand = { name: string; logo: string; primary: string; secondary: string; phone: string; instagram: string; facebook: string; address: string; preferences: Preferences; connections: Record<Network, Connection> };
export const emptyBrand: Brand = {
  name: '', logo: '', primary: '#3F63E9', secondary: '#F7F9FC', phone: '', instagram: '', facebook: '', address: '',
  preferences: { tone: 'Cercano', style: 'Moderno', hashtags: '', instructions: '' },
  connections: { instagram: { enabled: false, account: '' }, facebook: { enabled: false, account: '' }, whatsapp: { enabled: false, account: '' } },
};
/** Completa perfiles guardados antes de existir las preferencias y conexiones. */
export function normalizeBrand(saved?: Partial<Brand> | null): Brand {
  const { tone, style, hashtags, instructions } = { ...emptyBrand.preferences, ...saved?.preferences };
  const connections = Object.fromEntries(outputs.map(network => [network, { ...emptyBrand.connections[network], ...saved?.connections?.[network] }])) as Brand['connections'];
  return { ...emptyBrand, ...saved, preferences: { tone, style, hashtags, instructions }, connections };
}
/** Cada estilo combina los colores de la marca de forma distinta. */
export function styleLook(style: string, brand: Pick<Brand, 'primary' | 'secondary'>): Pick<Design, 'style' | 'font' | 'color' | 'background'> {
  if (style === 'Vibrante') return { style, font: 'sans', color: brand.secondary, background: brand.primary };
  if (style === 'Minimalista') return { style, font: 'serif', color: brand.primary, background: '#FFFFFF' };
  return { style, font: 'sans', color: brand.primary, background: brand.secondary };
}
export function intentOf(d: Pick<Design, 'objective'>) {
  return intents.find(intent => intent.objective === d.objective) || intents[0];
}
export type Generation = { status: 'processing' | 'completed' | 'error'; ticketId?: string; urls: Partial<Record<Network, string>>; error?: string };
export type Publication = { status: 'sending' | 'sent' | 'error'; at: string; error?: string };
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
  generation?: Generation;
  publications?: Partial<Record<Network, Publication>>;
  /** Texto propio de cada red (escrito con IA). Sin él, todas usan `caption`. */
  captions?: Partial<Record<Network, string>>;
};
export const captionLimits: Record<Network, number> = { instagram: 2200, facebook: 2000, whatsapp: 700 };
export function captionFor(d: Pick<Design, 'caption' | 'captions'>, network: Network) {
  return d.captions?.[network] || d.caption;
}
export function newDesign(source: Brand): Design {
  const now = new Date().toISOString();
  const brand = normalizeBrand(source);
  const { tone, style, hashtags, instructions } = brand.preferences;
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, brand: structuredCopy(brand), type: intents[0].type, objective: intents[0].objective, product: '', description: '', price: '', validity: '', contact: brand.phone, images: [], selectedImage: 0, format: outputs[0], tone, instructions, title: '', body: '', cta: 'Escríbenos', hashtags, caption: '', ...styleLook(style, brand), textX: 7, textY: 62, textSize: 68, imageX: 7, imageY: 16, imageWidth: 86, requests: [], schedule: null };
}
function structuredCopy(brand: Brand): Brand {
  return { ...brand, preferences: { ...brand.preferences }, connections: Object.fromEntries(outputs.map(network => [network, { ...brand.connections[network] }])) as Brand['connections'] };
}
export function duplicateDesign(design: Design): Design {
  const now = new Date().toISOString();
  return { ...design, id: crypto.randomUUID(), createdAt: now, updatedAt: now, title: design.title + ' · copia', requests: [], schedule: null, generation: undefined, publications: undefined };
}
export function suggestCopy(d: Design, variant = 0) {
  const names = [d.product, `Descubre ${d.product}`, `${d.product}, para ti`];
  const offer = d.objective === 'Promocionar una oferta';
  const title = offer ? `${variant % 2 ? 'Una oferta para ti' : 'Dale un gusto a tu día'}` : names[variant % names.length];
  const endings: Record<string, string> = { Cercano: 'Conoce más y conversemos.', Profesional: 'Consulta los detalles y realiza tu pedido.', Juvenil: '¡Descúbrelo y compártelo!', Elegante: 'Un detalle que hace la diferencia.', Divertido: '¡Tu próximo favorito te espera!' };
  const body = `${d.description || d.product}. ${endings[d.tone] || endings.Cercano}`.slice(0, 180);
  const cta = d.objective === 'Atraer visitas' ? 'Visítanos' : d.objective === 'Invitar a un evento' ? 'Reserva tu lugar' : d.objective === 'Informar' ? 'Conoce más' : 'Haz tu pedido';
  const tag = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '');
  const fixed = (d.brand.preferences?.hashtags || '').split(/[\s,]+/).map(t => tag(t.replace(/^#/, '')));
  const hashtags = Array.from(new Set([tag(d.brand.name), tag(d.product), ...fixed, 'Emprendimiento'].filter(Boolean))).map(t => '#' + t).join(' ');
  return { title: title.slice(0, 80), body, cta, hashtags, captions: undefined, caption: `${title}\n\n${body}${d.price ? '\nPrecio: ' + d.price : ''}${d.validity ? '\n' + d.validity : ''}${d.contact ? '\nContacto: ' + d.contact : ''}\n\n${cta}\n${hashtags}` };
}
export function generationPayload(d: Design) {
  // Las cuentas conectadas no le sirven al generador; se envían solo al publicar.
  return { version: 1, requestId: d.id, business: { ...d.brand, connections: undefined }, product: { name: d.product, description: d.description, price: d.price, images: d.images }, content: { type: d.type, objective: d.objective, format: d.format, dimensions: formats[d.format], outputs: outputs.map(network => ({ network, ...formats[network] })), style: d.style, colors: { primary: d.color, background: d.background }, tone: d.tone, instructions: d.instructions, validity: d.validity, contact: d.contact }, copy: { title: d.title, body: d.body, cta: d.cta, hashtags: d.hashtags, caption: d.caption, captions: d.captions }, edits: d.requests, schedule: d.schedule };
}
export function publishPayload(d: Design, network: Network, account: string, image: string) {
  return { version: 1, requestId: d.id, network, account, image, dimensions: formats[network], caption: captionFor(d, network) || [d.title, d.body, d.cta, d.hashtags].filter(Boolean).join('\n'), business: d.brand.name };
}

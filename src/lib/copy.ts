import { captionLimits, Design, intentOf, Network } from './studio';

// Textos con IA. Las imágenes van por n8n; el copy es una llamada de texto barata y aparte.
// Ambos proveedores usan el formato de chat de OpenAI. Groq va primero porque tiene plan gratuito.
export const copyProviders = {
  groq: { label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY', model: 'openai/gpt-oss-120b', extra: { reasoning_effort: 'low' } },
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', keyEnv: 'OPENAI_API_KEY', model: 'gpt-4o-mini', extra: {} },
  xai: { label: 'Grok (xAI)', url: 'https://api.x.ai/v1/chat/completions', keyEnv: 'XAI_API_KEY', model: 'grok-4.20-0309-non-reasoning', extra: {} },
} as const;
export type CopyProvider = keyof typeof copyProviders;

/** Proveedores con clave configurada, en orden de uso. `COPY_PROVIDER` fuerza uno primero. */
export function availableProviders(env: Record<string, string | undefined>) {
  const order = (Object.keys(copyProviders) as CopyProvider[]).sort((a, b) => Number(b === env.COPY_PROVIDER) - Number(a === env.COPY_PROVIDER));
  return order.filter(id => env[copyProviders[id].keyEnv]).map(id => ({
    id,
    ...copyProviders[id],
    key: env[copyProviders[id].keyEnv] as string,
    url: env[`${id.toUpperCase()}_API_URL`] || copyProviders[id].url,
    model: env[`${id.toUpperCase()}_MODEL`] || copyProviders[id].model,
  }));
}

export const copyLimits = { title: 60, body: 160, cta: 30, hashtags: 300 } as const;
export type Copy = { title: string; body: string; cta: string; hashtags: string; caption: string; captions: Record<Network, string> };

export function copyRequest(d: Design, avoid = '') {
  return { business: d.brand.name, product: d.product, description: d.description, price: d.price, validity: d.validity, contact: d.contact, intent: intentOf(d).label, tone: d.tone, brandHashtags: d.brand.preferences?.hashtags || '', instagram: d.brand.instagram, address: d.brand.address, avoid };
}
export type CopyRequest = ReturnType<typeof copyRequest>;

const tones: Record<string, string> = {
  Cercano: 'cálido y cercano, como una emprendedora que le escribe a sus clientas de confianza; tutea',
  Profesional: 'confiable, claro y ordenado, sin jerga; trata de usted',
  Juvenil: 'fresco, con energía y expresiones actuales sin exagerar; tutea',
  Elegante: 'sobrio y aspiracional, frases cuidadas, pocos emojis y sutiles',
  Divertido: 'con humor ligero y juegos de palabras, sin perder claridad; tutea',
};

const captionSchema = (description: string) => ({ type: 'string', description });
export const copySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: `Titular del diseño, 3 a 8 palabras, máximo ${copyLimits.title} caracteres` },
    body: { type: 'string', description: `Texto del diseño, una o dos frases, máximo ${copyLimits.body} caracteres` },
    cta: { type: 'string', description: `Llamado a la acción del diseño, máximo ${copyLimits.cta} caracteres` },
    instagram: captionSchema('Caption de Instagram, 120 a 220 palabras, sin hashtags'),
    facebook: captionSchema('Post de Facebook, 70 a 140 palabras, sin hashtags'),
    whatsapp: captionSchema('Texto del estado de WhatsApp, 25 a 60 palabras, sin hashtags'),
    hashtags: { type: 'array', items: { type: 'string' }, description: 'Entre 8 y 12 hashtags para Instagram' },
  },
  required: ['title', 'body', 'cta', 'instagram', 'facebook', 'whatsapp', 'hashtags'],
  additionalProperties: false,
} as const;

// Ejemplo de referencia del estilo buscado (negocio ficticio). Solo para el formato, no para copiar datos.
const example = [
  '¿Tu mesa de domingo pide algo especial? 🍰',
  '',
  'Nuestra torta de lúcuma con manjar se hace el mismo día, con lúcuma de verdad y bizcocho esponjoso que no se seca. Es la que más nos piden para cumpleaños, y ya sabemos por qué 😍',
  '',
  '✅ Para 12 porciones',
  '✅ Decoración personalizada con el nombre que quieras',
  '✅ Lista para recoger desde las 10 a. m.',
  '',
  '💰 S/ 85',
  '📍 Recojo en Surco',
  '📲 Pedidos al 987 654 321',
  '',
  'Separa la tuya con 24 horas de anticipación 👉 escríbenos por DM o WhatsApp.',
  '',
  '¿Lúcuma o chocolate? Te leemos en comentarios 👇',
].join('\n');

export function copyMessages(input: CopyRequest) {
  const system = [
    'Eres community manager de pequeños negocios en Perú. Escribes copies que se ven como los posts que mejor funcionan en Instagram, Facebook y WhatsApp de emprendimientos peruanos: con gancho, emoción, beneficios claros y un llamado a la acción concreto.',
    'Español natural de Perú (S/ para soles, "separa el tuyo", "pedidos al", "delivery" solo si se menciona). Nada de relleno genérico como "alta calidad", "calidad garantizada", "el mejor precio" o "no te lo pierdas": cada frase debe decir algo concreto del producto o de quien lo usa.',
    'REGLA DE ORO: nunca inventes datos. Usa solo el precio, la vigencia, el contacto, la dirección y las características que recibes. No inventes delivery, envíos, stock limitado (ni frases como "antes de que se agoten" o "últimas unidades"), descuentos, sabores, tallas, medios de pago ni horarios. Si un dato falta, no lo menciones. Las características del producto salen SOLO de la descripción: no le atribuyas propiedades que no estén escritas (resistente, duradero, fácil de limpiar, sin químicos, hipoalergénico, orgánico, de calidad premium, etc.). Los beneficios sí pueden ser consecuencias directas de lo escrito (por ejemplo, "pintado a mano" → "ninguno es igual a otro") o momentos de uso.',
    'Sin markdown (nada de ** ni #títulos), sin comillas envolventes. Usa saltos de línea reales entre bloques.',
    '',
    'title y body se imprimen sobre la imagen: deben ser cortos y potentes. title: 3 a 8 palabras que despierten deseo o curiosidad. body: una o dos frases con el beneficio principal. cta: verbo en imperativo acorde a la intención (Separa el tuyo, Pídelo hoy, Reserva tu lugar, Visítanos, Escríbenos).',
    '',
    'instagram (entre 150 y 220 palabras; apunta a unas 180), en este orden:',
    '1. Gancho en la primera línea que detenga el scroll: pregunta, situación con la que el cliente se identifica o afirmación potente, con 1 emoji.',
    '2. Línea en blanco y un párrafo de 3 a 4 frases que cuente la historia del producto o el problema que resuelve: cómo se hace, cómo se siente o se usa, y en qué momento de la vida del cliente encaja.',
    '3. Lista de 4 o 5 beneficios o características, una por línea, cada una iniciando con un emoji (✅, ✨, 🎁 u otro pertinente) y explicando el beneficio, no solo el dato.',
    '4. Bloque de datos, una línea cada uno y solo si existen: 💰 precio, 🗓️ vigencia, 📍 dirección, 📲 contacto.',
    '5. Llamado a la acción claro (DM, WhatsApp o visita) y, si hay vigencia, urgencia basada en esa fecha.',
    '6. Cierra con una pregunta sencilla que invite a comentar.',
    'Entre 5 y 9 emojis en total. Sin hashtags dentro del texto.',
    '',
    'facebook (90 a 140 palabras): más conversacional, en 3 o 4 párrafos cortos separados por una línea en blanco; cuenta para quién es ideal el producto o en qué ocasión se usa, incluye los datos que existan (precio, vigencia, dirección, contacto en texto) y cierra con el llamado a la acción. 2 a 4 emojis. Sin hashtags.',
    '',
    'whatsapp (30 a 60 palabras): estado directo para clientes que ya te conocen, en 3 o 4 líneas cortas. Una línea de gancho con emoji, el producto con su precio si existe, la vigencia si existe y cierra con "Respóndeme este estado" o "Escríbeme" para pedir. 1 a 3 emojis. Sin hashtags.',
    '',
    'hashtags: 8 a 12, sin espacios, en CamelCase y en español, mezclando producto, categoría, distrito o ciudad si se conoce y emprendimiento local (por ejemplo EmprendimientoPeruano, HechoEnPeru). Incluye siempre los hashtags de la marca y el nombre completo del negocio; nunca partas el nombre del negocio ni uses palabras sueltas sin sentido.',
    '',
    'Ejemplo de estilo para instagram (negocio ficticio, no copies sus datos):',
    example,
  ].join('\n');
  const user = [
    `Tono de la marca: ${tones[input.tone] || tones.Cercano}.`,
    `Intención de la publicación: ${input.intent}.`,
    input.avoid ? `Ya se usó esta versión; escribe una con otro gancho y otro enfoque: ${input.avoid}` : '',
    'Datos reales del negocio y del producto (JSON; los campos vacíos no existen):',
    JSON.stringify({ negocio: input.business, producto: input.product, descripcion: input.description, precio: input.price, vigencia: input.validity, contacto: input.contact, instagram: input.instagram, direccion: input.address, hashtagsDeMarca: input.brandHashtags }),
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function clip(value: unknown, max: number) {
  const text = typeof value === 'string' ? value.replace(/\r\n/g, '\n').replace(/^["'“«\s]+|["'”»\s]+$/g, '').replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return (cut.slice(0, cut.lastIndexOf(' ')) || cut).replace(/[\s,;:.-]+$/, '') + '…';
}
const tag = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '');
// El modelo a veces repite hashtags al final del texto; se quitan para añadir los nuestros una sola vez.
const withoutHashtags = (text: string) => text.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trim();

/** Valida la respuesta del modelo: recorta a los límites, quita hashtags sueltos y asegura los de la marca. */
export function sanitizeCopy(raw: unknown, input: Pick<CopyRequest, 'brandHashtags'>): Copy | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const title = clip(value.title, copyLimits.title);
  const cta = clip(value.cta, copyLimits.cta);
  if (!title || !cta) return null;
  const list = Array.isArray(value.hashtags) ? value.hashtags : typeof value.hashtags === 'string' ? value.hashtags.split(/[\s,]+/) : [];
  const brand = input.brandHashtags.split(/[\s,]+/);
  const tags = Array.from(new Set([...brand, ...list].filter((item): item is string => typeof item === 'string').map(item => tag(item.replace(/^#/, ''))).filter(Boolean))).slice(0, 12).map(item => '#' + item);
  const hashtags = tags.join(' ').slice(0, copyLimits.hashtags).trim();
  const facebookTags = tags.slice(0, 3).join(' ');
  const text = (key: Network, extra: string) => {
    const body = withoutHashtags(clip(value[key], captionLimits[key] - extra.length - 2));
    return extra ? `${body}\n\n${extra}` : body;
  };
  const captions = { instagram: text('instagram', hashtags), facebook: text('facebook', facebookTags), whatsapp: text('whatsapp', '') };
  if (!withoutHashtags(captions.instagram)) return null;
  return { title, body: clip(value.body, copyLimits.body), cta, hashtags, caption: captions.instagram, captions };
}

export async function requestCopy(d: Design, avoid = ''): Promise<Copy> {
  const response = await fetch('/api/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copyRequest(d, avoid)) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.copy) throw new Error(data.error || 'No se pudo escribir el texto con IA.');
  return data.copy;
}

'use client';
import { useState } from 'react';
import { Brand } from '@/lib/studio';
import { Field, Panel, Photos } from './Fields';
import { Save } from 'lucide-react';

export function BrandForm({ initial, onSave }: { initial: Brand; onSave: (brand: Brand) => Promise<void> }) {
  const [brand, setBrand] = useState(initial), [busy, setBusy] = useState(false);
  const change = (patch: Partial<Brand>) => setBrand(b => ({ ...b, ...patch }));
  return <form className="brand-form" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSave({ ...brand, name: brand.name.trim() }); } finally { setBusy(false); } }}>
    <div className="page-heading"><span className="eyebrow">TU IDENTIDAD</span><h1>Un negocio, tu estilo.</h1><p>Configura tu marca una vez. Sus datos estarán disponibles en tus próximas publicaciones.</p></div>
    <div className="two-columns"><Panel title="Así te reconocerán"><Field label="Nombre del negocio" value={brand.name} onChange={name => change({ name })} maxLength={60} required placeholder="Ej. Taller de cerámica Luna" /><label className="field"><span>Logo del negocio · opcional</span></label><Photos logo images={brand.logo ? [brand.logo] : []} onChange={images => change({ logo: images[0] || '' })} /><div className="color-row"><label>Color principal<input aria-label="Color principal de marca" type="color" value={brand.primary} onChange={e => change({ primary: e.target.value })} /></label><label>Color de fondo<input aria-label="Color de fondo de marca" type="color" value={brand.secondary} onChange={e => change({ secondary: e.target.value })} /></label></div></Panel>
    <Panel title="Dónde te encuentran"><Field label="WhatsApp o teléfono" type="tel" value={brand.phone} onChange={phone => change({ phone })} maxLength={25} placeholder="Ej. +51 999 123 456" /><Field label="Instagram" value={brand.instagram} onChange={instagram => change({ instagram })} maxLength={80} placeholder="@tunegocio" /><Field label="Facebook" value={brand.facebook} onChange={facebook => change({ facebook })} maxLength={80} placeholder="Nombre o enlace de tu página" /><Field label="Dirección o zona de atención" value={brand.address} onChange={address => change({ address })} maxLength={100} placeholder="Ej. Miraflores, Lima" /><p className="hint">Estos datos se muestran en el diseño. Agregar una red aquí no conecta la cuenta.</p></Panel></div>
    <div className="actions"><button className="primary" disabled={busy || !brand.name.trim()}><Save size={18} />{busy ? 'Guardando…' : 'Guardar mi negocio'}</button><p className="hint">Se guarda en este navegador.</p></div>
  </form>;
}

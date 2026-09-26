'use client';
import { ReactNode } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { readPhoto } from '@/lib/studio-storage';
import { useState } from 'react';

export function Field({ label, value, onChange, multiline = false, type = 'text', maxLength = 120, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string; maxLength?: number; placeholder?: string; required?: boolean }) {
  return <label className="field"><span>{label}{required && <span className="required"> *</span>}</span>{multiline ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} required={required} /> : <input type={type} value={value} onChange={e => onChange(e.target.value)} onInput={e => { if (type === 'datetime-local') onChange(e.currentTarget.value); }} onBlur={e => { if (type === 'datetime-local') onChange(e.currentTarget.value); }} maxLength={maxLength} placeholder={placeholder} required={required} />}</label>;
}
export function Choices({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset className="choices"><legend>{label}</legend><div>{options.map(option => <button type="button" aria-pressed={value === option} className={value === option ? 'choice selected' : 'choice'} key={option} onClick={() => onChange(option)}>{option}</button>)}</div></fieldset>;
}
export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{title && <h2>{title}</h2>}{children}</section>;
}
export function Photos({ images, onChange, logo = false }: { images: string[]; onChange: (images: string[]) => void; logo?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const limit = logo ? 1 : 3;
  async function upload(files: File[]) {
    setError(''); if (files.length + images.length > limit) { setError(`Puedes agregar hasta ${limit} ${logo ? 'logo' : 'fotos'}.`); return; }
    setBusy(true);
    try { const result = await Promise.all(files.map(file => readPhoto(file, logo))); onChange([...images, ...result]); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="photo-upload"><div className="photo-list">{images.map((src, i) => <div className="photo" key={i}><img src={src} alt={logo ? 'Logo del negocio' : `Foto del producto ${i + 1}`} /><button type="button" disabled={busy} onClick={() => onChange(images.filter((_, index) => index !== i))} aria-label={`Quitar ${logo ? 'logo' : 'foto ' + (i + 1)}`}><X size={16} /></button>{!logo && <span>{i === 0 ? 'Principal' : `Foto ${i + 1}`}</span>}</div>)}{images.length < limit && <label className={`upload-tile ${busy ? 'is-busy' : ''}`}><ImagePlus size={26} /><b>{busy ? 'Procesando…' : logo ? 'Subir logo' : 'Agregar fotos'}</b><input aria-label={logo ? 'Subir logo' : 'Agregar fotos del producto'} type="file" accept="image/jpeg,image/png,image/webp" multiple={!logo} disabled={busy} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) void upload(files); }} /></label>}</div><p className="hint">JPG, PNG o WebP. Máximo 8 MB por imagen.{!logo && ` ${images.length}/3 fotos. Al menos una es obligatoria.`}</p>{error && <p className="error" role="alert">{error}</p>}</div>;
}

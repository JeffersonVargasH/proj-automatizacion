'use client';

import React, { useMemo, useState } from 'react';
import { Download, ImagePlus, Share2, Sparkles, Type, WandSparkles } from 'lucide-react';
import { useWizardStore } from '@/store/useWizardStore';

type Format = 'post' | 'story' | 'whatsapp';

const formats: { id: Format; label: string; ratio: string }[] = [
  { id: 'post', label: 'Post', ratio: '1:1' },
  { id: 'story', label: 'Historia', ratio: '9:16' },
  { id: 'whatsapp', label: 'WhatsApp', ratio: '4:5' },
];

export function StepPreview() {
  const { productName, productImages, objective, price, date, phone, visualStyle, outputFormat, changeRequest, resetWizard } = useWizardStore();
  const [format, setFormat] = useState<Format>(outputFormat);
  const [headline, setHeadline] = useState(productName || 'Tu producto especial');
  const [description, setDescription] = useState('Una opción deliciosa para disfrutar y compartir.');
  const [accent, setAccent] = useState(visualStyle === 'minimalista' ? '#403b36' : visualStyle === 'moderno' ? '#0f4a50' : '#b34033');
  const [saved, setSaved] = useState(false);
  const [image, setImage] = useState(productImages[0] || '');
  const [history, setHistory] = useState<{ headline: string; format: Format; accent: string }[]>([]);

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveDesign = () => {
    const item = { headline, description, format, accent, image };
    const previous = JSON.parse(localStorage.getItem('impulsa-design-history') || '[]');
    localStorage.setItem('impulsa-design-history', JSON.stringify([item, ...previous].slice(0, 6)));
    setHistory([item, ...previous].slice(0, 6));
    setSaved(true);
  };

  const objectiveLabel = useMemo(() => ({ oferta: 'OFERTA ESPECIAL', nuevo: 'NUEVO LANZAMIENTO', invitacion: 'TE INVITAMOS' }[objective] || 'PARA TI'), [objective]);
  const sizeClass = format === 'story' ? 'aspect-[9/16] max-h-[470px]' : format === 'whatsapp' ? 'aspect-[4/5] max-h-[430px]' : 'aspect-square max-h-[430px]';

  const downloadDesign = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = format === 'story' ? 1920 : format === 'whatsapp' ? 1350 : 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f8f4ee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, canvas.width, 190);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 58px Arial'; ctx.fillText(objectiveLabel, 70, 120);
    ctx.fillStyle = '#172126'; ctx.font = 'bold 92px Arial'; ctx.fillText(headline.slice(0, 20), 70, 430);
    ctx.font = '38px Arial'; ctx.fillText(description.slice(0, 38), 70, 510);
    if (price) { ctx.fillStyle = accent; ctx.font = 'bold 74px Arial'; ctx.fillText(price, 70, 720); }
    ctx.fillStyle = '#172126'; ctx.font = '34px Arial'; ctx.fillText(date || 'Disponible ahora', 70, 820); ctx.fillText(phone || 'Escríbenos para más información', 70, 880);
    const link = document.createElement('a'); link.download = `flyer-${headline.replace(/\s+/g, '-').toLowerCase()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  };

  return <div className="flex flex-col gap-5 animate-slide-up pb-10">
    <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-[#b34033]">Tu diseño está listo</p><h1 className="text-2xl font-bold text-[#0f4a50] mt-1">Edita y comparte tu publicación</h1><p className="text-sm text-slate-500 mt-1">Haz cambios rápidos y descarga el formato que necesitas.</p>{changeRequest && <p className="mt-3 rounded-xl bg-[#fff2ee] p-3 text-xs text-slate-600"><b>Preferencia:</b> {changeRequest}</p>}</div>
    <div className="flex gap-2 overflow-x-auto pb-1">{formats.map((item) => <button key={item.id} onClick={() => setFormat(item.id)} className={`min-w-[105px] rounded-xl border px-3 py-2 text-left ${format === item.id ? 'border-[#0f4a50] bg-[#eef5f6]' : 'border-slate-200 bg-white'}`}><span className="block text-sm font-bold text-slate-700">{item.label}</span><span className="text-xs text-slate-400">{item.ratio}</span></button>)}</div>
    <div className="flex justify-center rounded-3xl bg-slate-100 p-5"><div className={`relative w-full max-w-[300px] overflow-hidden rounded-2xl bg-[#f8f4ee] shadow-xl transition-all ${sizeClass}`}><div className="absolute inset-x-0 top-0 h-24" style={{ backgroundColor: accent }} /><div className="relative flex h-full flex-col justify-center p-7"><span className="mb-5 text-xs font-black tracking-[.2em] text-white">{objectiveLabel}</span><div className="mb-5 flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-white/80 text-5xl">{image ? <img src={image} alt="Imagen del producto" className="h-full w-full object-cover" /> : '✨'}</div><h2 className="text-3xl font-black leading-tight text-slate-800">{headline}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>{price && <p className="mt-5 text-3xl font-black" style={{ color: accent }}>{price}</p>}<p className="mt-4 text-xs font-semibold text-slate-500">{date || 'Disponible ahora'} {phone && `· ${phone}`}</p></div></div></div>
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2 font-bold text-slate-700"><Type className="h-4 w-4" /> Personaliza tu diseño</div><label className="mb-1 block text-xs font-semibold text-slate-500">Título</label><input value={headline} onChange={e => setHeadline(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#0f4a50]" /><label className="mb-1 block text-xs font-semibold text-slate-500">Descripción</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#0f4a50]" /><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"><ImagePlus className="h-4 w-4" />{image ? 'Cambiar imagen' : 'Agregar imagen'}<input type="file" accept="image/*" onChange={handleImage} className="hidden" /></label><div className="mt-3 flex items-center gap-3"><span className="text-xs font-semibold text-slate-500">Color principal</span>{['#0f4a50', '#b34033', '#403b36', '#7c3aed'].map(color => <button key={color} aria-label={`Usar color ${color}`} onClick={() => setAccent(color)} className={`h-7 w-7 rounded-full border-2 ${accent === color ? 'border-slate-900 ring-2 ring-slate-200' : 'border-white'}`} style={{ backgroundColor: color }} />)}</div></div>
    <div className="grid grid-cols-2 gap-3"><button onClick={saveDesign} className="flex items-center justify-center gap-2 rounded-xl border border-[#0f4a50] py-3 font-bold text-[#0f4a50]"><Sparkles className="h-4 w-4" />{saved ? 'Guardado' : 'Guardar'}</button><button onClick={downloadDesign} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-bold text-white"><Download className="h-4 w-4" />Descargar</button></div>
    <div className="grid grid-cols-2 gap-3"><button onClick={() => navigator.share?.({ title: headline, text: 'Mira mi publicación' })} className="flex items-center justify-center gap-2 rounded-xl bg-[#eef5f6] py-3 text-sm font-bold text-[#0f4a50]"><Share2 className="h-4 w-4" />Compartir</button><button onClick={() => { setHeadline(productName || headline); setDescription('Una opción deliciosa para disfrutar y compartir.'); }} className="flex items-center justify-center gap-2 rounded-xl bg-[#fff2ee] py-3 text-sm font-bold text-[#b34033]"><WandSparkles className="h-4 w-4" />Regenerar texto</button></div>
    {history.length > 0 && <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h2 className="mb-3 font-bold text-slate-700">Diseños guardados</h2><div className="flex gap-2 overflow-x-auto">{history.map((item, index) => <button key={`${item.headline}-${index}`} onClick={() => { setHeadline(item.headline); setFormat(item.format); setAccent(item.accent); }} className="min-w-[120px] rounded-xl bg-slate-50 p-3 text-left"><div className="mb-2 h-12 rounded-lg" style={{ backgroundColor: item.accent }} /><span className="block truncate text-xs font-bold text-slate-700">{item.headline}</span><span className="text-[10px] text-slate-400">{item.format}</span></button>)}</div></div>}
    <button onClick={() => { resetWizard(); window.location.reload(); }} className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-400"><ImagePlus className="h-4 w-4" />Crear otra publicación</button>
  </div>;
}

'use client';

import React from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { MessageSquareText } from 'lucide-react';

interface StyleOption {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageLabel: string;
  colors: string[];
}

const STYLES: StyleOption[] = [
  {
    id: 'moderno',
    title: 'Moderno y Limpio 🏙️',
    description: 'Perfecto para transmitir profesionalismo y elegancia en tu negocio.',
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
    imageLabel: 'Estilo Premium',
    colors: ['bg-[#3157d5]', 'bg-indigo-400', 'bg-slate-300', 'bg-amber-100'],
  },
  {
    id: 'vibrante',
    title: 'Vibrante y Juvenil 🎉',
    description: 'Colores llamativos que capturan la atención rápido en redes.',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=600&auto=format&fit=crop',
    imageLabel: 'Para Redes Sociales',
    colors: ['bg-[#c94b45]', 'bg-orange-400', 'bg-amber-300', 'bg-violet-500'],
  },
  {
    id: 'minimalista',
    title: 'Minimalista ☕',
    description: 'Menos es más. Espacios en blanco y tipografía clara.',
    imageUrl: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=600&auto=format&fit=crop',
    imageLabel: 'Elegancia Simple',
    colors: ['bg-stone-800', 'bg-stone-400', 'bg-stone-200', 'bg-white'],
  },
];

interface StepStyleProps {
  onNext: () => void;
}

export function StepStyle({ onNext }: StepStyleProps) {
  const { visualStyle, outputFormat, changeRequest, setVisualStyle, setOutputFormat, setChangeRequest } = useWizardStore();

  const handleSelect = (id: string) => {
    setVisualStyle(id);
  };

  const handleContinue = () => {
    if (visualStyle) {
      onNext();
    }
  };

  return (
    <div className="flex min-h-full flex-col animate-slide-up relative">
      <div className="mt-4 mb-4">
         <h2 className="text-[22px] font-bold text-[#0f4a50] leading-tight">
           Elige un estilo visual
         </h2>
         <p className="text-slate-500 text-sm mt-1">
           Selecciona cómo quieres que se vea tu flyer.
         </p>
      </div>
      
      <div className="flex flex-col gap-4 pb-24">
        {STYLES.map((style) => {
          const isSelected = visualStyle === style.id;
          return (
            <button
              key={style.id}
              onClick={() => handleSelect(style.id)}
              className={`text-left bg-white rounded-[24px] p-4 border-2 transition-all ${
                isSelected 
                  ? 'border-[#0f4a50] shadow-md' 
                  : 'border-transparent shadow-sm'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-[#0f4a50] text-lg">
                  {style.title}
                </h3>
                {isSelected && (
                  <span className="bg-[#0f4a50] text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                    Elegido
                  </span>
                )}
              </div>

              {/* Image Container */}
              <div className="relative h-[120px] rounded-2xl overflow-hidden mb-4 bg-slate-100">
                <img 
                  src={style.imageUrl} 
                  alt={style.title} 
                  className="object-cover w-full h-full"
                />
                <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="text-white text-xs font-semibold shadow-sm">
                    {style.imageLabel}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                {style.description}
              </p>
              
              {/* Color Palette */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide mr-1">Paleta:</span>
                <div className="flex gap-2">
                  {style.colors.map((color, idx) => (
                    <div 
                      key={idx} 
                      className={`w-5 h-5 rounded-full shadow-sm border border-black/5 ${color}`}
                    ></div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="font-bold text-[#0f4a50]">¿Dónde vas a publicar?</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">El diseño se adaptará automáticamente al formato elegido.</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['post', 'Post', '1:1'],
            ['story', 'Historia', '9:16'],
            ['whatsapp', 'WhatsApp', '4:5'],
          ] as const).map(([id, label, ratio]) => <button key={id} onClick={() => setOutputFormat(id)} className={`rounded-xl border-2 px-2 py-3 text-center ${outputFormat === id ? 'border-[#0f4a50] bg-[#eef5f6]' : 'border-slate-100'}`}><span className="block text-sm font-bold text-slate-700">{label}</span><span className="text-[10px] text-slate-400">{ratio}</span></button>)}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 font-bold text-slate-700"><MessageSquareText className="h-4 w-4 text-[#b34033]" />¿Quieres pedir algún cambio?</div>
        <p className="mb-2 text-xs text-slate-500">Puedes dejarlo vacío y pedir cambios después en la vista previa.</p>
        <textarea value={changeRequest} onChange={e => setChangeRequest(e.target.value)} rows={3} placeholder="Ej. Usa colores cálidos y un estilo elegante" className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-100 focus:bg-white focus:ring-[#0f4a50]" />
      </div>

      {/* Floating Action Button inside Step */}
      <div className="fixed bottom-[90px] left-0 w-full pointer-events-none flex justify-center z-30">
        <button
          onClick={handleContinue}
          disabled={!visualStyle}
          className="pointer-events-auto w-[calc(100%-40px)] max-w-[calc(28rem-40px)] mx-5 bg-[#0f4a50] text-white rounded-[20px] py-4 text-[15px] font-bold text-center shadow-[0_8px_30px_rgb(15,74,80,0.3)] hover:bg-[#0c393e] transition-colors disabled:opacity-0 disabled:-translate-y-4 duration-300 transform"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { Mic, Store, Plus, ImagePlus, X } from 'lucide-react';

const SUGGESTIONS = [
  'Helado de Fresa',
  'Copa Especial',
  'Hamburguesa Clásica',
  'Pizza Margarita',
];

interface StepProductProps {
  onNext: () => void;
}

export function StepProduct({ onNext }: StepProductProps) {
  const { productName, productImages, setProductName, setProductImages } = useWizardStore();

  const handleImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 3 - productImages.length);
    if (!files.length) return;
    Promise.all(files.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    }))).then(images => setProductImages([...productImages, ...images]));
    event.target.value = '';
  };

  const handleSuggestionClick = (suggestion: string) => {
    setProductName(suggestion);
  };

  const handleContinue = () => {
    if (productName.trim().length > 0 && productImages.length > 0) {
      onNext();
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6 animate-slide-up">
      {/* Chat Bubble from Assistant */}
      <div className="flex items-end gap-3 mt-4">
        <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center shrink-0 shadow-sm text-white font-bold">
          AI
        </div>
        <div className="bg-white rounded-2xl rounded-bl-none p-4 shadow-sm border border-slate-100 relative">
          <p className="text-slate-700 font-medium leading-snug">
            ¿Qué producto o servicio quieres mostrar en tu flyer?
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <div><p className="font-bold text-slate-700">Imágenes del producto</p><p className="text-xs text-slate-400">Sube entre 1 y 3 fotos claras.</p></div>
          <span className="text-xs font-bold text-slate-400">{productImages.length}/3</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {productImages.map((image, index) => <div key={image} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"><img src={image} alt={`Producto ${index + 1}`} className="h-full w-full object-cover" /><button onClick={() => setProductImages(productImages.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white" aria-label="Quitar imagen"><X className="h-3 w-3" /></button></div>)}
          {productImages.length < 3 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#0f4a50] hover:text-[#0f4a50]"><ImagePlus className="h-6 w-6" /><span className="mt-1 text-[10px] font-bold">Agregar foto</span><input type="file" accept="image/*" multiple onChange={handleImages} className="hidden" /></label>}
        </div>
        {productImages.length === 0 && <p className="mt-2 text-xs font-semibold text-[#b34033]">Agrega al menos una imagen para continuar.</p>}
      </div>
      
      {/* Input Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="px-4 pt-3 flex justify-between items-center text-xs font-semibold text-slate-400">
          <span>Nombre del producto</span>
          <span>{productName.length} letras</span>
        </div>
        
        <textarea
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Escribe aquí..."
          className="w-full min-h-[100px] px-4 py-2 text-lg font-medium text-slate-800 placeholder-slate-300 resize-none outline-none"
        />
        
        <div className="px-4 pb-3">
          <div className="bg-slate-50 text-slate-500 text-xs p-2 rounded-lg mb-3">
            <span className="font-semibold text-slate-600">Ejemplo:</span> Helado artesanal de vainilla con chispas
          </div>
          
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-brand-50 text-brand-600 font-bold rounded-xl hover:bg-brand-100 transition-colors">
            <Mic className="w-5 h-5" />
            Toca para dictar con tu voz
          </button>
        </div>
      </div>

      {/* Suggestions Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center gap-2 mb-4 text-brand-900 font-bold">
          <Store className="w-5 h-5 text-brand-600" />
          Helados Naturales La Abuela
        </div>
        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="bg-slate-100 text-slate-400 p-1.5 rounded-full group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-medium text-slate-700">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={productName.trim().length === 0 || productImages.length === 0}
        className="w-full mt-4 mb-4 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg shadow-premium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continuar
      </button>
    </div>
  );
}

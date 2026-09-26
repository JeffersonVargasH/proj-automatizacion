'use client';

import React from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { Edit2, PackageOpen, Target, Palette, Sparkles } from 'lucide-react';

interface StepReviewProps {
  onNext: () => void;
  onEditStep: (stepNumber: number) => void;
}

export function StepReview({ onNext, onEditStep }: StepReviewProps) {
  const { productName, objective, visualStyle, price, date, phone } = useWizardStore();

  const getObjectiveLabel = (obj: string) => {
    switch (obj) {
      case 'oferta': return 'Oferta o descuento';
      case 'nuevo': return 'Nuevo producto';
      case 'invitacion': return 'Invitación';
      default: return obj;
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6 animate-slide-up pb-8">
      <div className="text-center mt-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-100 rounded-full mb-4 text-brand-600">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          Resumen de tu diseño
        </h1>
        <p className="text-slate-500 text-sm mt-2 px-4">
          Verifica que todo esté correcto antes de generar tu flyer profesional.
        </p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {/* Product */}
          <li className="p-4 flex items-start gap-4">
            <div className="p-2 bg-slate-100 text-slate-500 rounded-full shrink-0">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 mb-0.5">Producto o Servicio</p>
              <p className="text-sm font-bold text-slate-800">{productName}</p>
            </div>
            <button onClick={() => onEditStep(1)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
          </li>
          
          {/* Objective */}
          <li className="p-4 flex items-start gap-4">
            <div className="p-2 bg-slate-100 text-slate-500 rounded-full shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 mb-0.5">Objetivo</p>
              <p className="text-sm font-bold text-slate-800">{getObjectiveLabel(objective)}</p>
              
              {/* Extra info if exists */}
              {(price || date || phone) && (
                <div className="mt-2 flex flex-col gap-1">
                  {price && <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block w-fit">💰 {price}</span>}
                  {date && <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block w-fit">📅 {date}</span>}
                  {phone && <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block w-fit">📞 {phone}</span>}
                </div>
              )}
            </div>
            <button onClick={() => onEditStep(2)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
          </li>

          {/* Style */}
          <li className="p-4 flex items-start gap-4">
            <div className="p-2 bg-slate-100 text-slate-500 rounded-full shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 mb-0.5">Estilo Visual</p>
              <p className="text-sm font-bold text-slate-800 capitalize">{visualStyle}</p>
            </div>
            <button onClick={() => onEditStep(3)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
          </li>
        </ul>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-3 mt-4 mb-4 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg shadow-premium hover:bg-slate-800 transition-colors"
      >
        <Sparkles className="w-5 h-5" />
        Sí, preparar mi flyer ahora
      </button>
    </div>
  );
}

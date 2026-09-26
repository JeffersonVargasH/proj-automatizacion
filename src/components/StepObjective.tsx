'use client';

import React, { useState } from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { Tag, Sparkles, MailOpen, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ObjectiveOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

const OBJECTIVES: ObjectiveOption[] = [
  {
    id: 'oferta',
    title: 'Oferta o descuento',
    description: 'Atrae clientes con una promoción especial.',
    icon: <Tag className="w-6 h-6" />,
    colorClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'nuevo',
    title: 'Nuevo producto',
    description: 'Anuncia un lanzamiento espectacular.',
    icon: <Sparkles className="w-6 h-6" />,
    colorClass: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'invitacion',
    title: 'Invitación',
    description: 'Invita a las personas a un evento especial.',
    icon: <MailOpen className="w-6 h-6" />,
    colorClass: 'bg-purple-100 text-purple-600',
  },
];

interface StepObjectiveProps {
  onNext: () => void;
}

export function StepObjective({ onNext }: StepObjectiveProps) {
  const { objective, setObjective, price, date, phone, setPrice, setDate, setPhone } = useWizardStore();
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  const handleSelect = (id: string) => {
    setObjective(id);
  };

  const handleContinue = () => {
    if (objective) {
      onNext();
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-5 animate-slide-up">
      <div className="flex items-end gap-3 mt-4">
        <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center shrink-0 shadow-sm text-white font-bold">
          AI
        </div>
        <div className="bg-white rounded-2xl rounded-bl-none p-4 shadow-sm border border-slate-100">
          <p className="text-slate-700 font-medium leading-snug">
            ¿Qué quieres comunicar hoy con este producto?
          </p>
        </div>
      </div>
      
      <div className="flex flex-col gap-3 mt-2">
        {OBJECTIVES.map((opt) => {
          const isSelected = objective === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`relative flex items-center gap-4 p-4 text-left rounded-2xl border-2 transition-all duration-200 bg-white ${
                isSelected 
                  ? 'border-brand-500 shadow-sm' 
                  : 'border-slate-100 hover:border-brand-200'
              }`}
            >
              <div className={`p-3 rounded-xl ${opt.colorClass}`}>
                {opt.icon}
              </div>
              <div className="flex-1 pr-6">
                <h3 className="font-bold text-slate-800 text-base">
                  {opt.title}
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  {opt.description}
                </p>
              </div>
              {isSelected && (
                <div className="absolute right-4 text-brand-500 animate-fade-in">
                  <CheckCircle2 className="w-6 h-6 fill-current text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Accordion for optional info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-2">
        <button 
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          className="w-full flex items-center justify-between p-4 font-semibold text-slate-700 text-sm"
        >
          Agregar más información (Opcional)
          {isAccordionOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        
        {isAccordionOpen && (
          <div className="px-4 pb-5 pt-1 flex flex-col gap-4 animate-slide-up">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Precio</label>
              <input 
                type="text" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ej. $10.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha o Validez</label>
              <input 
                type="text" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="Ej. Válido hasta el viernes"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono de contacto</label>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. +1 234 567 890"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleContinue}
        disabled={!objective}
        className="w-full mt-4 mb-4 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg shadow-premium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continuar
      </button>
    </div>
  );
}

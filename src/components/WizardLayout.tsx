import React from 'react';
import { ArrowLeft, Home, Sparkles, Folder, Volume2 } from 'lucide-react';

interface WizardLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps?: number;
  onBack?: () => void;
}

export function WizardLayout({
  children,
  currentStep,
  totalSteps = 5,
  onBack,
}: WizardLayoutProps) {
  return (
    <div className="flex flex-col h-screen relative bg-[#f8f9fc]">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 flex justify-between items-center px-4 py-3 z-20">
        <button
          onClick={onBack}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          aria-label="Atrás"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center">
          <div className="text-[10px] uppercase text-slate-500 font-bold flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#b34033]"></span>
            Paso {currentStep} de {totalSteps}
          </div>
          <span className="font-bold text-[#0f4a50] text-sm leading-tight">
            Diseño
          </span>
        </div>
        
        <button
          className="bg-[#eef5f6] text-[#0f4a50] px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5"
          aria-label="Escuchar"
        >
          <Volume2 className="w-4 h-4" />
          <span>Oír</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-36 pt-2">
        <div className="h-full animate-fade-in relative">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <footer className="absolute bottom-0 w-full bg-white border-t border-slate-100 flex justify-around items-center py-3 pb-6 z-20">
        <button className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-[#0f4a50] transition-colors">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-semibold mt-1">Inicio</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 text-white absolute left-1/2 -translate-x-1/2 top-0 mt-[-20px]">
          <div className="bg-[#b34033] p-3 rounded-full border-4 border-white shadow-lg text-white">
             <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-[#b34033] mt-1 absolute -bottom-4">Crear</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-[#0f4a50] transition-colors">
          <Folder className="w-6 h-6" />
          <span className="text-[10px] font-semibold mt-1">Historial</span>
        </button>
      </footer>
    </div>
  );
}

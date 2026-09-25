'use client';

import { useState } from 'react';
import { WizardLayout } from '@/components/WizardLayout';
import { StepProduct } from '@/components/StepProduct';
import { StepObjective } from '@/components/StepObjective';
import { StepStyle } from '@/components/StepStyle';
import { StepReview } from '@/components/StepReview';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4; // Updated from 5 to 4 for now

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps + 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleEditStep = (stepNumber: number) => {
    setCurrentStep(stepNumber);
  };

  return (
    <WizardLayout 
      currentStep={Math.min(currentStep, totalSteps)} 
      onBack={handleBack}
      totalSteps={totalSteps}
    >
      {currentStep === 1 && <StepProduct onNext={handleNext} />}
      {currentStep === 2 && <StepObjective onNext={handleNext} />}
      {currentStep === 3 && <StepStyle onNext={handleNext} />}
      {currentStep === 4 && <StepReview onNext={handleNext} onEditStep={handleEditStep} />}
      
      {currentStep > 4 && (
        <div className="text-center py-20 text-slate-800 font-bold text-xl animate-fade-in mt-10">
          <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-premium">
             {/* Simple checkmark SVG */}
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
             </svg>
          </div>
          ¡Generando Flyer!
          <p className="text-sm text-slate-500 font-medium mt-3 px-4">
            Estamos conectando con el asistente para crear tu diseño. Esto tomará unos segundos.
          </p>
          <button 
             onClick={() => setCurrentStep(1)} 
             className="block mx-auto mt-8 px-6 py-3 bg-slate-100 text-slate-600 rounded-full text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      )}
    </WizardLayout>
  );
}

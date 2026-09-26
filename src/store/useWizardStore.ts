import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

interface WizardState {
  // Datos del Usuario
  userUuid: string;
  
  // Datos del Flyer
  productName: string;
  objective: string;
  visualStyle: string;
  imageUrl: string;
  productImages: string[];
  changeRequest: string;
  outputFormat: 'post' | 'story' | 'whatsapp';
  extraInfo: string;
  price: string;
  date: string;
  phone: string;

  // Acciones
  setProductName: (name: string) => void;
  setObjective: (objective: string) => void;
  setVisualStyle: (style: string) => void;
  setImageUrl: (url: string) => void;
  setProductImages: (images: string[]) => void;
  setChangeRequest: (request: string) => void;
  setOutputFormat: (format: 'post' | 'story' | 'whatsapp') => void;
  setExtraInfo: (info: string) => void;
  setPrice: (price: string) => void;
  setDate: (date: string) => void;
  setPhone: (phone: string) => void;
  
  // Resetear el wizard para un nuevo flyer
  resetWizard: () => void;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      // Generar UUID anónimo si no existe en localStorage
      userUuid: uuidv4(),
      
      productName: '',
      objective: '',
      visualStyle: '',
      imageUrl: '',
      productImages: [],
      changeRequest: '',
      outputFormat: 'post',
      extraInfo: '',
      price: '',
      date: '',
      phone: '',

      setProductName: (name) => set({ productName: name }),
      setObjective: (obj) => set({ objective: obj }),
      setVisualStyle: (style) => set({ visualStyle: style }),
      setImageUrl: (url) => set({ imageUrl: url }),
      setProductImages: (images) => set({ productImages: images }),
      setChangeRequest: (request) => set({ changeRequest: request }),
      setOutputFormat: (format) => set({ outputFormat: format }),
      setExtraInfo: (info) => set({ extraInfo: info }),
      setPrice: (price) => set({ price }),
      setDate: (date) => set({ date }),
      setPhone: (phone) => set({ phone }),
      
      resetWizard: () => set({
        productName: '',
        objective: '',
        visualStyle: '',
        imageUrl: '',
        productImages: [],
        changeRequest: '',
        outputFormat: 'post',
        extraInfo: '',
        price: '',
        date: '',
        phone: '',
      }),
    }),
    {
      name: 'impulsa-wizard-storage', // Clave en localStorage
      partialize: (state) => ({ userUuid: state.userUuid }), // Solo persistir el UUID por ahora, el resto se resetea si el usuario recarga (opcional: quitar partialize si queremos que el wizard también persista)
    }
  )
);

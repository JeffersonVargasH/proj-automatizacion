// Tipografías disponibles en el editor. Geist llega con next/font; las demás son fuentes del sistema
// presentes en la mayoría de equipos (si faltan, el navegador usa la alternativa de la lista).
export const editorFonts = [
  { label: 'Geist (Clic)', family: 'Geist, Arial, sans-serif' },
  { label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet', family: "'Trebuchet MS', Arial, sans-serif" },
  { label: 'Georgia', family: 'Georgia, serif' },
  { label: 'Times', family: "'Times New Roman', Times, serif" },
  { label: 'Courier', family: "'Courier New', Courier, monospace" },
] as const;

/** Nombre corto de una familia guardada (o la propia familia si no es de la lista). */
export function fontLabel(family: string): string {
  return editorFonts.find(font => font.family === family)?.label ?? family.split(',')[0].replace(/['"]/g, '').trim();
}

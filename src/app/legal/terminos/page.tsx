import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Términos de servicio · CreaMás' };

export default function TermsPage() {
  return <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1C1C1E', lineHeight: 1.6 }}>
    <p style={{ color: '#3F63E9', fontWeight: 700, letterSpacing: '.08em' }}>CREAMÁS</p>
    <h1>Términos de servicio</h1>
    <p><strong>Borrador para revisión legal.</strong> Este documento describe las reglas base del servicio y debe ser revisado y aprobado antes de publicarse como versión contractual.</p>
    <h2>1. Servicio</h2><p>CreaMás permite crear piezas de contenido para negocios, guardar borradores, preparar textos y, cuando las integraciones estén habilitadas, conectar servicios de generación, programación y publicación.</p>
    <h2>2. Responsabilidad del usuario</h2><p>El usuario debe contar con derechos para usar las imágenes, marcas, textos y demás materiales que cargue. También debe revisar el contenido generado antes de publicarlo.</p>
    <h2>3. Generación automática</h2><p>Las funciones de IA pueden producir resultados incompletos o incorrectos. El usuario conserva la responsabilidad de verificar precios, fechas, afirmaciones y cumplimiento de las reglas de cada red social.</p>
    <h2>4. Integraciones y disponibilidad</h2><p>Las redes sociales, pasarelas de pago y proveedores externos pueden imponer requisitos, límites o interrupciones independientes de CreaMás. Las publicaciones automáticas solo se ejecutarán cuando la integración esté conectada y autorizada.</p>
    <h2>5. Planes y pagos</h2><p>Los planes, límites, precios, renovaciones y cancelaciones deben ser aprobados antes de activar cobros reales. El entorno actual usa únicamente modo de pruebas y no procesa pagos.</p>
    <h2>6. Contacto</h2><p>Reemplaza esta sección con la razón social, correo de soporte, jurisdicción y procedimiento de reclamos antes del lanzamiento.</p>
    <p style={{ marginTop: 48, color: '#667085' }}>Última actualización: noviembre de 2026 · Documento pendiente de aprobación legal.</p>
  </main>;
}

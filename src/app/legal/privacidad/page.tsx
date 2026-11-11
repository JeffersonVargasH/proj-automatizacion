import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de privacidad · Clic' };

export default function PrivacyPage() {
  return <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1C1C1E', lineHeight: 1.6 }}>
    <p style={{ color: '#3F63E9', fontWeight: 700, letterSpacing: '.08em' }}>CLIC</p>
    <h1>Política de privacidad</h1>
    <p><strong>Borrador para revisión legal.</strong> Completa responsables, finalidades, plazos y derechos aplicables antes de publicar esta política.</p>
    <h2>1. Datos que podemos tratar</h2><p>Podemos tratar datos de cuenta, información del negocio, datos de contacto, imágenes cargadas, textos de publicaciones, preferencias de formato y registros técnicos necesarios para operar el servicio.</p>
    <h2>2. Finalidades</h2><p>Usamos estos datos para autenticar usuarios, guardar diseños, aplicar límites del plan, generar contenido solicitado, atender incidencias y mantener la seguridad del servicio.</p>
    <h2>3. Imágenes y proveedores</h2><p>Las imágenes se almacenan en espacios privados y se entregan mediante enlaces temporales. Si se activa la generación con IA, las referencias necesarias se envían al proveedor configurado para procesar la solicitud.</p>
    <h2>4. Redes sociales</h2><p>Las cuentas de redes solo deben conectarse mediante permisos autorizados. Los tokens y permisos deben almacenarse y revocarse siguiendo las reglas del proveedor correspondiente.</p>
    <h2>5. Conservación y eliminación</h2><p>Define aquí cuánto tiempo se conservan cuentas, diseños, imágenes, registros de uso y trabajos fallidos, además del procedimiento para solicitar acceso, rectificación o eliminación.</p>
    <h2>6. Responsable y contacto</h2><p>Reemplaza esta sección con la identidad del responsable del tratamiento, correo de privacidad, país y autoridad de control correspondiente.</p>
    <p style={{ marginTop: 48, color: '#667085' }}>Última actualización: noviembre de 2026 · Documento pendiente de aprobación legal.</p>
  </main>;
}

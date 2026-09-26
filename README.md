# Impulsa — frontend

Estudio local de publicaciones para emprendedores. Incluye inicio, identidad del negocio, creación guiada, editor visual, exportación PNG, compartir archivos e historial con búsqueda, duplicación y eliminación.

## Ejecutar

```sh
npm run dev
npm run build
npm start
```

Si el npm global de Windows está dañado, los ejecutables locales funcionan directamente:

```sh
node node_modules/next/dist/bin/next dev
node node_modules/next/dist/bin/next build
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/studio.test.cjs
```

## Qué funciona localmente

- Datos de marca, logo, colores y contacto reutilizables.
- De una a tres imágenes JPG, PNG o WebP, hasta 8 MB cada una; optimizadas al cargar.
- Tipo de contenido, objetivo, datos del producto, tono y sugerencias de texto basadas en plantillas.
- Cinco formatos: cuadrado, vertical, historia, Facebook horizontal y estado de WhatsApp.
- Vista previa y PNG usan el mismo renderizador; incluye foto, marca y datos.
- Posiciones con arrastre, flechas de teclado y controles de rango; cambio de tamaño, colores y fuente.
- IndexedDB conserva perfil, borrador y diseños completos en este navegador. El historial guarda una instantánea al pulsar Guardar diseño; los cambios posteriores permanecen en el borrador hasta volver a guardar.
- Compartir usa archivos mediante Web Share cuando está disponible; en otros navegadores descarga el PNG y explica cómo enviarlo.

## Pendiente de backend

La maqueta local no es una imagen generada con IA. Las sugerencias de texto son plantillas. Las solicitudes de modificación se conservan como `pending`; las fechas deseadas tienen estado `pending_connection`. Ninguna de estas acciones llama un servicio externo, programa un trabajo real ni publica en redes.

`generationPayload(design)` en `src/lib/studio.ts` define el contrato inicial para la integración futura. Contiene negocio, producto, las tres referencias, objetivo, formato, dimensiones, estilo, tono, textos, instrucciones y solicitudes. Antes de conectar n8n se deben subir las imágenes mediante una API del servidor y sustituir los data URLs por URLs autorizadas. No colocar credenciales o webhooks secretos en el cliente.

La futura API de generación deberá devolver un ID de trabajo y estados de procesamiento, éxito o error. Para editar textos por separado sobre una imagen generada, el backend tendrá que devolver capas o un fondo sin texto: un PNG aplanado por sí solo no ofrece edición de capas.

La ruta previa `/api/upload` se conserva pero el flujo local no la utiliza. Requiere configurar su almacenamiento antes de integrarla.

## Verificación manual

Configurar negocio → crear publicación → comprobar que no permite avanzar sin foto → subir hasta 3 fotos → probar texto y formatos → crear maqueta → editar y descargar → guardar → abrir historial → duplicar → recargar y recuperar. Revisar a 390 px y en escritorio. Probar tipos de archivo rechazados y fechas pasadas. `node tests/create-fixture.cjs` crea una imagen de prueba local en `tests/artifacts`.

# Clic — frontend

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

## Integración con n8n en Docker

La web ya dispone de dos proxies server-side para no exponer la URL ni el token de n8n al navegador:

- `POST /api/generate`: envía `generationPayload(design)` y espera `{ "ticket_id": "..." }`.
- `GET /api/generate/status?ticket_id=...`: espera `{ "status": "processing" | "completed" | "error", "finalUrl": "..." }`.

Copia `.env.example` como `.env.local` y ajusta las URLs si n8n no está publicado en el puerto local 5678. En n8n, crea un Webhook `POST /creamas-generate` que responda inmediatamente con un `ticket_id`, y otro Webhook `GET /status` que consulte el estado almacenado. El workflow debe actualizar ese estado al terminar y devolver `finalUrl` con la imagen generada.

El JSON de `Images.json` parte de Telegram y termina enviando un video a Telegram; no es todavía el workflow web de CreaMás. Se dejó una adaptación importable en `n8n/creamas-openai-images.json`: recibe el contrato de `generationPayload`, responde un `ticket_id`, conserva la rama de análisis/prompt y usa OpenAI Image API para generar la imagen. También expone el estado mediante `GET /webhook/status`. El resultado se guarda temporalmente como `data:` URL para que el prototipo pueda mostrarlo y descargarlo desde el editor.

Para usar la adaptación:

1. En n8n importa `n8n/creamas-openai-images.json` y activa el workflow. Conecta las credenciales de OpenAI en `OpenAI Vision: Analyze Reference Image` y `LLM: OpenAI Chat`.
2. Expón `OPENAI_API_KEY` al contenedor n8n. El nodo `OpenAI: Generate Image` la usa únicamente en el servidor para llamar a `https://api.openai.com/v1/images/generations`; no la pongas en el frontend ni la guardes en el JSON.
3. En `.env.local` configura `N8N_GENERATE_WEBHOOK_URL` y `N8N_STATUS_WEBHOOK_URL`. Si Next corre en el host y n8n publica el puerto `5678`, los valores de `.env.example` funcionan.
4. La imagen de referencia actual llega como data URL. Para una instalación real conviene subirla primero a Spaces/S3 y enviar una URL autorizada; el almacenamiento temporal en `data:` URL es solo para validar el flujo local y puede ocupar bastante memoria en n8n.

La adaptación no modifica ni sobrescribe `C:\Users\yo\Downloads\Images.json`; ese archivo original conserva el flujo Telegram/video. Las credenciales y tokens que contenga deben revocarse y regenerarse si fueron expuestos.

## Verificación manual

Configurar negocio → crear publicación → comprobar que no permite avanzar sin foto → subir hasta 3 fotos → probar texto y formatos → crear maqueta → editar y descargar → guardar → abrir historial → duplicar → recargar y recuperar. Revisar a 390 px y en escritorio. Probar tipos de archivo rechazados y fechas pasadas. `node tests/create-fixture.cjs` crea una imagen de prueba local en `tests/artifacts`.

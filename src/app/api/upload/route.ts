import { NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, DO_BUCKET } from '@/lib/s3';
import { v4 as uuidv4 } from 'uuid';
import { requireServerSession } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const session = await requireServerSession();
    if (!session) return NextResponse.json({ error: 'Debes iniciar sesión para subir una imagen.' }, { status: 401 });
    const { filename, contentType } = await request.json();

    if (typeof filename !== 'string' || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(contentType) || filename.length > 180) {
      return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP.' }, { status: 400 });
    }

    // Generar un nombre aleatorio para evitar colisiones
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      return NextResponse.json({ error: 'La extensión de la imagen no es válida.' }, { status: 400 });
    }
    const uniqueFilename = `${uuidv4()}.${extension}`;
    const objectKey = `uploads/${session.user.id}/${uniqueFilename}`;

    const command = new PutObjectCommand({
      Bucket: DO_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });

    // Generar presigned URL válida por 5 minutos
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const imageUrl = `/api/upload?key=${encodeURIComponent(objectKey)}`;

    return NextResponse.json({ presignedUrl, imageUrl, objectKey });
  } catch (error) {
    console.error('Error generando presigned URL:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireServerSession();
    if (!session) return NextResponse.json({ error: 'Debes iniciar sesión para ver una imagen.' }, { status: 401 });
    const key = new URL(request.url).searchParams.get('key') || '';
    const prefix = `uploads/${session.user.id}/`;
    if (!key.startsWith(prefix) || key.includes('..')) return NextResponse.json({ error: 'La imagen no es válida.' }, { status: 403 });
    const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: DO_BUCKET, Key: key }), { expiresIn: 60 });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Error generando URL de lectura:', error);
    return NextResponse.json({ error: 'No se pudo leer la imagen.' }, { status: 500 });
  }
}

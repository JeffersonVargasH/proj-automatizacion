import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, DO_BUCKET } from '@/lib/s3';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Generar un nombre aleatorio para evitar colisiones
    const extension = filename.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${extension}`;
    const objectKey = `uploads/${uniqueFilename}`;

    const command = new PutObjectCommand({
      Bucket: DO_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      ACL: 'public-read', // Si el bucket está configurado para permitir lecturas públicas
    });

    // Generar presigned URL válida por 5 minutos
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // La URL final de la imagen será el endpoint + bucket + key 
    // Nota: El endpoint base debe coincidir con la URL pública de tu bucket (ej. https://impulsa-assets.nyc3.digitaloceanspaces.com/...)
    const publicEndpoint = process.env.DO_SPACES_PUBLIC_URL || `https://${DO_BUCKET}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`;
    const finalImageUrl = `${publicEndpoint}/${objectKey}`;

    return NextResponse.json({ presignedUrl, imageUrl: finalImageUrl });
  } catch (error) {
    console.error('Error generando presigned URL:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

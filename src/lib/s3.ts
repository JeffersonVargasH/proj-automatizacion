import { S3Client } from '@aws-sdk/client-s3';

// Asegúrate de tener estas variables de entorno en tu .env.local
const region = process.env.DO_SPACES_REGION || 'nyc3';
const endpoint = process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com';
const accessKeyId = process.env.DO_SPACES_KEY || '';
const secretAccessKey = process.env.DO_SPACES_SECRET || '';

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const DO_BUCKET = process.env.DO_SPACES_BUCKET || 'impulsa-assets';

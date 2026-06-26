import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2 } from './lib/r2.js';
import { R2_BUCKET } from './lib/config.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { contentType, filename } = req.body ?? {};
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'invalid content type' });
  }

  const ext = filename?.split('.').pop() ?? 'jpg';
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );

  res.json({ url, key });
}

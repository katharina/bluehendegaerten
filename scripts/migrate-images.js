import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, '../uploads');

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.webp': 'image/webp',
  '.gif': 'image/gif',  '.heic': 'image/heic', '.heif': 'image/heif',
};

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function run() {
  const files = await readdir(UPLOADS);
  console.log(`Uploading ${files.length} files to R2…\n`);
  let ok = 0, fail = 0;
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';
    try {
      const body = await readFile(join(UPLOADS, file));
      await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: file,
        Body: body,
        ContentType: contentType,
      }));
      process.stdout.write(`  ✓ ${file}\n`);
      ok++;
    } catch (e) {
      process.stdout.write(`  ✗ ${file}: ${e.message}\n`);
      fail++;
    }
  }
  console.log(`\n✓ ${ok} uploaded, ${fail} failed`);
}

run().catch(console.error);

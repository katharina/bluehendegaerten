import { PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { r2 } from '../lib/r2.js';
import { R2_BUCKET } from '../lib/config.js';

await r2.send(new PutBucketCorsCommand({
  Bucket: R2_BUCKET,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: ['https://bluehendegaerten.vercel.app', 'http://localhost:5173'],
        AllowedMethods: ['PUT', 'GET'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3600,
      },
    ],
  },
}));

console.log('CORS set on', R2_BUCKET);

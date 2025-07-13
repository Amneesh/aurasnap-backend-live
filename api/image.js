import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import Cors from 'cors';

dotenv.config();

// Initialize CORS middleware
const cors = Cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
});

// Helper to run middleware in Vercel
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

const s3Client = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  await runMiddleware(req, res, cors);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') return res.status(405).end();

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key param' });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({ signedUrl });
  } catch (error) {
    console.error('Signed URL error:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
}

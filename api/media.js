import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: 'images/',
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);

    const files = (response.Contents || []).map((file) => ({
      key: file.Key,
      title: file.Key.split('/').pop(),
      signedUrl: `/api/image?key=${encodeURIComponent(file.Key)}`,
    }));

    res.status(200).json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not list media' });
  }
}

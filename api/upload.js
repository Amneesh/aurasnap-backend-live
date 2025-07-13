import formidable from 'formidable';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import dotenv from 'dotenv';
import Cors from 'cors';
import sharp from 'sharp'; // ✅ import sharp

dotenv.config();

export const config = {
  api: {
    bodyParser: false,
  },
};

const cors = Cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'],
});

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Form parsing failed' });
    }

    let file = files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (Array.isArray(file)) file = file[0];

    try {
      // ✅ Compress and convert to WebP using sharp
      const webpBuffer = await sharp(file.filepath)
        .webp({ quality: 80 })
        .toBuffer();

      const fileName = `${uuidv4()}.webp`; // webp extension
      const key = `images/${fileName}`;

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: webpBuffer, // upload compressed image buffer
          ContentType: 'image/webp',
        },
      });

      await upload.done();

      return res.status(200).json({ message: 'Upload successful', key });
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed' });
    }
  });
}

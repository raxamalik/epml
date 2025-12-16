import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

const useR2 = !!(
  process.env.CLOUDFLARE_ACCOUNT_ID &&
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
  process.env.CLOUDFLARE_R2_BUCKET_NAME
);

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const ensureUploadsDir = async () => {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
};

const storage = useR2
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: async (req, file, cb) => {
        await ensureUploadsDir();
        cb(null, UPLOADS_DIR);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  }
});

export async function uploadToR2(file: Express.Multer.File): Promise<string> {
  if (!useR2) {
    throw new Error('R2 storage is not configured');
  }

  const { r2Storage } = await import('./r2Storage');
  
  const fileExtension = path.extname(file.originalname);
  const key = `images/${randomUUID()}${fileExtension}`;
  
  if (!file.buffer) {
    throw new Error('File buffer is missing. Make sure multer is using memory storage.');
  }
  
  const publicUrl = await r2Storage.uploadFile(
    file.buffer,
    key,
    file.mimetype
  );

  return publicUrl;
}

if (!useR2) {
  ensureUploadsDir().catch(console.error);
}

export { UPLOADS_DIR, useR2 };

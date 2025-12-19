import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

class R2StorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string = '';
  private publicUrl: string = '';
  private initialized: boolean = false;

  private initialize() {
    if (this.initialized) {
      return;
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing required Cloudflare R2 environment variables');
    }

    this.bucketName = bucketName;
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || `https://${accountId}.r2.cloudflarestorage.com/${bucketName}`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.initialized = true;
  }

  async uploadFile(
    file: Buffer | Readable,
    key: string,
    contentType: string
  ): Promise<string> {
    this.initialize();
    
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      return `/api/r2-image/${key}`;
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    this.initialize();
    
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    this.initialize();
    
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      throw new Error(`Failed to delete file from R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.initialize();
    
    if (!this.s3Client) {
      throw new Error('R2 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}

export const r2Storage = new R2StorageService();

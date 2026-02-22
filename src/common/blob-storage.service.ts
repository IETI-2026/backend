import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName: string;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'blobStorage.connectionString',
    );
    this.containerName = this.configService.get<string>(
      'blobStorage.containerName',
      'profile-photos',
    );

    if (!connectionString) {
      throw new Error(
        'AZURE_STORAGE_CONNECTION_STRING environment variable is not set',
      );
    }

    this.blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
  }

  /**
   * Uploads a file buffer to Azure Blob Storage and returns the public URL.
   * @param buffer       File contents
   * @param originalName Original filename (used to derive extension)
   * @param contentType  MIME type of the file
   * @param folder       Folder prefix inside the container (e.g. userId)
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    contentType: string,
    folder: string,
  ): Promise<string> {
    const ext = extname(originalName) || '.bin';
    const blobName = `${folder}/${randomUUID()}${ext}`;

    const containerClient = this.blobServiceClient.getContainerClient(
      this.containerName,
    );

    // Ensure container exists (idempotent)
    await containerClient.createIfNotExists({ access: 'blob' });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    this.logger.log(`Uploaded blob: ${blobName}`);
    return blockBlobClient.url;
  }
}

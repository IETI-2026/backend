import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly containerName: string;
  private readonly connectionString: string;

  constructor() {
    // Azure Blob Storage applies AES-256 server-side encryption by default.
    // Verify SSE is enabled in the Azure Portal under:
    // Storage account > Security + networking > Encryption
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    const containerName = process.env.STORAGE_CONTAINER_NAME;

    if (!connectionString) {
      throw new Error('STORAGE_CONNECTION_STRING is not defined');
    }
    if (!containerName) {
      throw new Error('STORAGE_CONTAINER_NAME is not defined');
    }

    this.connectionString = connectionString;
    this.containerName = containerName;
  }

  private getContainerClient(): ContainerClient {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connectionString,
    );
    return blobServiceClient.getContainerClient(this.containerName);
  }

  async uploadFile(
    file: Express.Multer.File,
    userEmail?: string,
  ): Promise<string> {
    const containerClient = this.getContainerClient();
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const blobName = userEmail ? `${userEmail}/${fileName}` : fileName;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    this.logger.log(`Uploaded file: ${blobName}`);
    return blockBlobClient.url;
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    userEmail?: string,
  ): Promise<string> {
    const containerClient = this.getContainerClient();
    const blobName = userEmail ? `${userEmail}/${fileName}` : fileName;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    this.logger.log(`Uploaded buffer: ${blobName}`);
    return blockBlobClient.url;
  }
}

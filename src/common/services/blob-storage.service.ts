import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly containerName = 'cameyo-storage';

  private getContainerClient(): ContainerClient {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('STORAGE_CONNECTION_STRING is not defined');
    }
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    return blobServiceClient.getContainerClient(this.containerName);
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const containerClient = this.getContainerClient();
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const blobName = `${crypto.randomUUID()}.${ext}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    this.logger.log(`Uploaded profile photo: ${blobName}`);
    return blockBlobClient.url;
  }
}

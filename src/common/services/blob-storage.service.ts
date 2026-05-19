import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly containerName: string;
  private readonly connectionString: string;
  private readonly accountName: string;
  private readonly accountKey: string;
  private readonly blobEndpoint: string;

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

    const parts = Object.fromEntries(
      connectionString
        .split(';')
        .filter(Boolean)
        .map((part) => {
          const idx = part.indexOf('=');
          return [part.slice(0, idx), part.slice(idx + 1)];
        }),
    );

    const accountName = parts['AccountName'];
    const accountKey = parts['AccountKey'];

    if (!accountName || !accountKey) {
      throw new Error(
        'STORAGE_CONNECTION_STRING must contain AccountName and AccountKey',
      );
    }

    this.accountName = accountName;
    this.accountKey = accountKey;
    this.blobEndpoint = `https://${accountName}.blob.core.windows.net`;
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

  generateSasUrl(blobName: string, expiryMinutes = 60): string {
    const credential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey,
    );
    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
      },
      credential,
    ).toString();
    const encodedBlobName = blobName
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    return `${this.blobEndpoint}/${this.containerName}/${encodedBlobName}?${sasToken}`;
  }

  toSasUrl(
    storedUrl: string | null | undefined,
    expiryMinutes = 60,
  ): string | null {
    if (!storedUrl) return null;
    const prefix = `${this.blobEndpoint}/${this.containerName}/`;
    if (!storedUrl.startsWith(prefix)) return storedUrl;
    // Decode each path component so the SAS is signed against the actual blob name
    const blobName = storedUrl
      .slice(prefix.length)
      .split('?')[0]
      .split('/')
      .map(decodeURIComponent)
      .join('/');
    return this.generateSasUrl(blobName, expiryMinutes);
  }
}

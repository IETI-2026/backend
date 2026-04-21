import { BlobStorageService } from '../blob-storage.service';

jest.mock('@azure/storage-blob', () => {
  const mockUploadData = jest.fn().mockResolvedValue({});
  const mockGetBlockBlobClient = jest.fn().mockReturnValue({
    uploadData: mockUploadData,
    url: 'https://storage.example.com/container/file.jpg',
  });
  const mockGetContainerClient = jest.fn().mockReturnValue({
    getBlockBlobClient: mockGetBlockBlobClient,
  });
  return {
    BlobServiceClient: {
      fromConnectionString: jest.fn().mockReturnValue({
        getContainerClient: mockGetContainerClient,
      }),
    },
  };
});

describe('BlobStorageService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      STORAGE_CONNECTION_STRING:
        'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net',
      STORAGE_CONTAINER_NAME: 'test-container',
    };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('constructor', () => {
    it('should throw if STORAGE_CONNECTION_STRING is missing', () => {
      delete process.env.STORAGE_CONNECTION_STRING;
      expect(() => new BlobStorageService()).toThrow(
        'STORAGE_CONNECTION_STRING is not defined',
      );
    });

    it('should throw if STORAGE_CONTAINER_NAME is missing', () => {
      delete process.env.STORAGE_CONTAINER_NAME;
      expect(() => new BlobStorageService()).toThrow(
        'STORAGE_CONTAINER_NAME is not defined',
      );
    });

    it('should construct successfully when both env vars are set', () => {
      expect(() => new BlobStorageService()).not.toThrow();
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return blob url', async () => {
      const service = new BlobStorageService();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image'),
        size: 10,
        stream: null as unknown,
        destination: '',
        filename: 'photo.jpg',
        path: '',
      };

      const url = await service.uploadFile(mockFile, 'user@example.com');

      expect(typeof url).toBe('string');
      expect(url).toContain('https://');
    });

    it('should upload file without userEmail prefix', async () => {
      const service = new BlobStorageService();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'doc.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('fake-pdf'),
        size: 100,
        stream: null as unknown,
        destination: '',
        filename: 'doc.pdf',
        path: '',
      };

      const url = await service.uploadFile(mockFile);

      expect(typeof url).toBe('string');
    });
  });

  describe('uploadBuffer', () => {
    it('should upload buffer and return blob url', async () => {
      const service = new BlobStorageService();
      const buffer = Buffer.from('pdf-content');

      const url = await service.uploadBuffer(
        buffer,
        'report.pdf',
        'application/pdf',
        'user@example.com',
      );

      expect(typeof url).toBe('string');
      expect(url).toContain('https://');
    });

    it('should upload buffer without userEmail', async () => {
      const service = new BlobStorageService();
      const buffer = Buffer.from('image-data');

      const url = await service.uploadBuffer(buffer, 'image.png', 'image/png');

      expect(typeof url).toBe('string');
    });
  });
});

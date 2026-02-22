import { registerAs } from '@nestjs/config';

export default registerAs('blobStorage', () => ({
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'profile-photos',
}));

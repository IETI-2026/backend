import appConfig from './app.config';
import azureAgentConfig from './azure-agent.config';
import blobStorageConfig from './blob-storage.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import oauthConfig from './oauth.config';

export const configs = [
  appConfig,
  databaseConfig,
  jwtConfig,
  azureAgentConfig,
  blobStorageConfig,
  oauthConfig,
];

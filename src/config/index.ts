import appConfig from './app.config';
import azureAgentConfig from './azure-agent.config';
import cacheConfig from './cache.config';
import databaseConfig from './database.config';
import externalServicesConfig from './external-services.config';
import googleConfig from './google.config';
import jwtConfig from './jwt.config';
import mailConfig from './mail.config';
import oauthConfig from './oauth.config';

export const configs = [
  appConfig,
  databaseConfig,
  jwtConfig,
  googleConfig,
  azureAgentConfig,
  externalServicesConfig,
  oauthConfig,
  mailConfig,
  cacheConfig,
];

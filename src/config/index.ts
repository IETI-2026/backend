import appConfig from './app.config';
import azureAgentConfig from './azure-agent.config';
import databaseConfig from './database.config';
import googleConfig from './google.config';
import jwtConfig from './jwt.config';
import oauthConfig from './oauth.config';

export const configs = [
  appConfig,
  databaseConfig,
  jwtConfig,
  googleConfig,
  azureAgentConfig,
  oauthConfig,
];

import { registerAs } from '@nestjs/config';

export default registerAs('azureAgent', () => ({
  endpoint: process.env.AGENT_ENDPOINT,
  apiKey: process.env.AGENT_API_KEY,
  apiVersion: process.env.AGENT_API_VERSION || '2024-12-01-preview',
}));

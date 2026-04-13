import { registerAs } from '@nestjs/config';

export default registerAs('azureAgent', () => {
  const endpoint = process.env.AGENT_ENDPOINT;
  if (!endpoint) {
    throw new Error('AGENT_ENDPOINT environment variable is not defined');
  }

  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) {
    throw new Error('AGENT_API_KEY environment variable is not defined');
  }

  return {
    endpoint,
    apiKey,
    apiVersion: process.env.AGENT_API_VERSION || '2024-12-01-preview',
  };
});

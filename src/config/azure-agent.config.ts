import { registerAs } from "@nestjs/config";

export default registerAs("azureAgent", () => ({
  endpoint: process.env.AZURE_AGENT_ENDPOINT,
  apiKey: process.env.AZURE_AGENT_API_KEY,
  apiVersion: process.env.AZURE_AGENT_API_VERSION || "2024-12-01-preview",
}));

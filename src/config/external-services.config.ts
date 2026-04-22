import { registerAs } from '@nestjs/config';

export default registerAs('externalServices', () => ({
  skillSuggestionEndpointUrl: process.env.SKILL_SUGGESTION_ENDPOINT_URL,
  documentVerificationUrl: process.env.DOCUMENT_VERIFICATION_URL,
}));

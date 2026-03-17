import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface MailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  mailFrom: string;
  nodeEnv: string;
}

export const mailConfigSchema = {
  SMTP_HOST: Joi.string().required().description('SMTP server host'),
  SMTP_PORT: Joi.number().required().description('SMTP server port'),
  SMTP_USER: Joi.string().email().required().description('SMTP user email'),
  SMTP_PASSWORD: Joi.string().required().description('SMTP password or App Password'),
  MAIL_FROM: Joi.string().required().description('Default sender email address'),
};

export default registerAs('mail', (): MailConfig => {
  const config: MailConfig = {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    mailFrom: process.env.MAIL_FROM || 'noreply@example.com',
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  return config;
});

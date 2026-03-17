import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

/**
 * Configuración SMTP para el servicio de correos
 *
 * @property smtpHost - Host del servidor SMTP
 * @property smtpPort - Puerto del servidor SMTP (típicamente 587 para STARTTLS o 465 para TLS)
 * @property smtpUser - Usuario/email para autenticación SMTP
 * @property smtpPassword - Contraseña o App Password para autenticación SMTP
 * @property mailFrom - Dirección de email por defecto para envíos
 * @property nodeEnv - Ambiente de ejecución (development, staging, production)
 */
export interface MailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  mailFrom: string;
  nodeEnv: string;
}

/**
 * Schema de validación para configuración de correos
 * Usa Joi para validar que todas las variables de entorno requeridas estén presentes
 * y sean del tipo correcto
 */
export const mailConfigSchema = {
  SMTP_HOST: Joi.string()
    .hostname()
    .required()
    .messages({
      'string.hostname': 'SMTP_HOST debe ser un hostname válido',
      'any.required': 'SMTP_HOST es requerido',
    })
    .description('SMTP server host (ej: smtp.gmail.com)'),

  SMTP_PORT: Joi.number()
    .port()
    .required()
    .messages({
      'number.port': 'SMTP_PORT debe ser un puerto válido (1-65535)',
      'any.required': 'SMTP_PORT es requerido',
    })
    .description('SMTP server port (587 para STARTTLS, 465 para TLS)'),

  SMTP_USER: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'SMTP_USER debe ser un email válido',
      'any.required': 'SMTP_USER es requerido',
    })
    .description('SMTP user email address'),

  SMTP_PASSWORD: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.empty': 'SMTP_PASSWORD no puede estar vacío',
      'any.required': 'SMTP_PASSWORD es requerido',
    })
    .description('SMTP password or App Password'),

  MAIL_FROM: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'MAIL_FROM debe ser un email válido',
      'any.required': 'MAIL_FROM es requerido',
    })
    .description('Default sender email address'),
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

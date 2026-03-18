import { MailTemplate } from '../enums/mail-template.enum';

export interface SendMailOptions {
  to: string | string[];
  templateName: MailTemplate;
  context: Record<string, unknown>;
  subject?: string;
  from?: string;
}

export type MailErrorType =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'TEMPLATE_ERROR'
  | 'NETWORK_ERROR'
  | 'SSL_ERROR'
  | 'SMTP_ERROR'
  | 'UNKNOWN_ERROR';

export type MailSendResult =
  | { success: true; messageId?: string }
  | { success: false; errorType: MailErrorType; error: string };

export interface MailTemplateDefinition {
  name: MailTemplate;
  defaultSubject: string;
  templatePath: string;
}

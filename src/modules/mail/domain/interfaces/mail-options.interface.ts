import { MailTemplate } from '../enums/mail-template.enum';

export interface SendMailOptions {
  to: string | string[];
  templateName: MailTemplate;
  context: Record<string, unknown>;
  subject?: string;
  from?: string;
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MailTemplateDefinition {
  name: MailTemplate;
  defaultSubject: string;
  templatePath: string;
}

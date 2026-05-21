import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailErrorType, MailSendResult, SendMailOptions } from '../domain';

const resolveMailError = (
  error: unknown,
): { type: MailErrorType; userMessage: string } =>
  error instanceof Error
    ? classifyNodemailerError(error)
    : { type: 'UNKNOWN_ERROR' as MailErrorType, userMessage: String(error) };

const classifyNodemailerError = (
  error: Error,
): { type: MailErrorType; userMessage: string } => {
  const message = error.message.toLowerCase();

  if (
    message.includes('eauth') ||
    message.includes('authentication') ||
    message.includes('auth') ||
    message.includes('invalid credentials') ||
    message.includes('535')
  ) {
    return {
      type: 'AUTH_ERROR',
      userMessage:
        'Error de autenticación SMTP. Verifica que el usuario y contraseña sean correctos.',
    };
  }

  if (
    message.includes('econnrefused') ||
    message.includes('connection refused') ||
    message.includes('ECONNREFUSED')
  ) {
    return {
      type: 'CONNECTION_ERROR',
      userMessage:
        'No se pudo conectar al servidor SMTP. Verifica el host y puerto.',
    };
  }

  if (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('timed out') ||
    message.includes('ETIMEDOUT')
  ) {
    return {
      type: 'TIMEOUT_ERROR',
      userMessage:
        'El servidor tardó demasiado en responder. Por favor, intenta más tarde.',
    };
  }

  if (
    message.includes('enoent') ||
    message.includes('template') ||
    message.includes('not found') ||
    message.includes('path')
  ) {
    return {
      type: 'TEMPLATE_ERROR',
      userMessage:
        'Plantilla de correo no encontrada. Por favor, contacta al equipo de soporte.',
    };
  }

  if (
    message.includes('network') ||
    message.includes('dns') ||
    message.includes('getaddrinfo') ||
    message.includes('ENOTFOUND')
  ) {
    return {
      type: 'NETWORK_ERROR',
      userMessage:
        'Error de red. Verifica tu conexión a internet e intenta más tarde.',
    };
  }

  if (
    message.includes('ssl') ||
    message.includes('tls') ||
    message.includes('certificate') ||
    message.includes('secure')
  ) {
    return {
      type: 'SSL_ERROR',
      userMessage:
        'Error de conexión segura (SSL/TLS). Contacta al equipo de soporte.',
    };
  }

  if (message.includes('smtp')) {
    return {
      type: 'SMTP_ERROR',
      userMessage: 'Error del servidor SMTP. Por favor, intenta más tarde.',
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    userMessage: error.message || 'Error desconocido al enviar el correo',
  };
};

@Injectable()
export class NodemailerService {
  private readonly logger: Logger = new Logger(NodemailerService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(options: SendMailOptions): Promise<MailSendResult> {
    try {
      // Validaciones de entrada
      if (!options || !options.to) {
        this.logger.warn('sendMail: Destinatario (to) es requerido');
        return {
          success: false,
          errorType: 'VALIDATION_ERROR',
          error: 'El destinatario (to) es requerido',
        };
      }

      if (!options.templateName) {
        this.logger.warn(
          'sendMail: Nombre de plantilla (templateName) es requerido',
        );
        return {
          success: false,
          errorType: 'VALIDATION_ERROR',
          error: 'El nombre de la plantilla (templateName) es requerido',
        };
      }

      const mailConfig = this.configService.get('mail');

      const context = {
        ...options.context,
        subject: options.subject || 'Notificación desde CameYo',
        year: new Date().getFullYear(),
        supportEmail: mailConfig?.mailFrom || 'support@camey.co',
      };

      const recipients = Array.isArray(options.to)
        ? options.to.join(', ')
        : options.to;

      this.logger.log(
        `Enviando correo a ${recipients} con plantilla: ${options.templateName}`,
      );

      const result = await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject || 'Notificación desde CameYo',
        template: options.templateName,
        context,
        from: options.from || mailConfig?.mailFrom,
      });

      this.logger.log(
        `Correo enviado exitosamente a ${recipients} (ID: ${result?.messageId})`,
      );

      return {
        success: true,
        messageId: result?.messageId,
      };
    } catch (error) {
      const errorInfo = resolveMailError(error);
      this.logger.error(
        `Error ${errorInfo.type} al enviar correo a ${options.to}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : '',
      );
      return {
        success: false,
        errorType: errorInfo.type,
        error: errorInfo.userMessage,
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const mailerWithTransporter = this.mailerService as unknown as {
        transporter?: { verify: () => Promise<unknown> };
      };

      if (!mailerWithTransporter.transporter) {
        this.logger.error('Transporter SMTP no disponible');
        return false;
      }

      await mailerWithTransporter.transporter.verify();
      this.logger.log('✓ Conexión SMTP verificada exitosamente');
      return true;
    } catch (error) {
      const errorInfo = resolveMailError(error);
      this.logger.error(
        `✗ Error verificando conexión SMTP (${errorInfo.type}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : '',
      );
      return false;
    }
  }
}

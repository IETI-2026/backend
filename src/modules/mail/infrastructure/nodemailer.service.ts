import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailSendResult, SendMailOptions } from '../domain';

@Injectable()
export class NodemailerService {
  private readonly logger: Logger = new Logger(NodemailerService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(options: SendMailOptions): Promise<MailSendResult> {
    try {
      if (!options || !options.to) {
        this.logger.warn('sendMail: Destinatario (to) es requerido');
        return {
          success: false,
          error: 'Destinatario es requerido',
        };
      }

      if (!options.templateName) {
        this.logger.warn(
          'sendMail: Nombre de plantilla (templateName) es requerido',
        );
        return {
          success: false,
          error: 'Nombre de plantilla es requerido',
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
        subject: options.subject || `Notificación desde CameYo`,
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error al enviar correo a ${options.to}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );

      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          return {
            success: false,
            error:
              'Plantilla de correo no encontrada. Por favor, contacta al equipo de soporte.',
          };
        }

        if (error.message.includes('SMTP')) {
          return {
            success: false,
            error:
              'Error de conexión con el servidor SMTP. Por favor, intenta más tarde.',
          };
        }

        if (error.message.includes('timeout')) {
          return {
            success: false,
            error:
              'El servidor tardó demasiado en responder. Por favor, intenta más tarde.',
          };
        }
      }

      return {
        success: false,
        error: errorMessage || 'Error desconocido al enviar el correo',
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `✗ Error verificando conexión SMTP: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );

      return false;
    }
  }
}

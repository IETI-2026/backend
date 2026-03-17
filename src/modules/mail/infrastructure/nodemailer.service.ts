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
      const mailConfig = this.configService.get('mail');

      const context = {
        ...options.context,
        year: new Date().getFullYear(),
        supportEmail: mailConfig?.mailFrom || 'support@camey.co',
      };

      const result = await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject || `Notificación desde CameYo`,
        template: options.templateName,
        context,
        from: options.from || mailConfig?.mailFrom,
      });

      this.logger.debug(
        `Correo enviado exitosamente a ${options.to}`,
        result.messageId,
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

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const mailerWithTransporter = this.mailerService as unknown as {
        transporter?: { verify: () => Promise<unknown> };
      };

      if (!mailerWithTransporter.transporter) {
        throw new Error('Transporter SMTP no disponible');
      }

      await mailerWithTransporter.transporter.verify();
      this.logger.log('Conexión SMTP verificada exitosamente');
      return true;
    } catch (error) {
      this.logger.error(
        'Error verificando conexión SMTP',
        error instanceof Error ? error.message : '',
      );
      return false;
    }
  }
}

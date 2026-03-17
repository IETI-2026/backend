import { Injectable, Logger } from '@nestjs/common';
import {
  MailTemplate,
  MailSendResult,
  SendMailOptions,
} from '../domain';
import { NodemailerService } from '../infrastructure';

@Injectable()
export class MailService {
  private readonly logger: Logger = new Logger(MailService.name);

  constructor(private readonly nodemailer: NodemailerService) { }

  /**
   * Envía correo de bienvenida a un nuevo usuario.
   *
   * @param to - Email del destinatario
   * @param userName - Nombre del usuario
   * @param profileUrl - URL para completar perfil
   * @returns MailSendResult
   *
   * @example
   * const result = await mailService.sendWelcomeEmail(
   *   'user@example.com',
   *   'Juan Pérez',
   *   'https://app.camey.co/complete-profile?token=...'
   * );
   * if (!result.success) {
   *   this.logger.error(`Fallo enviando welcome: ${result.error}`);
   * }
   */
  async sendWelcomeEmail(
    to: string,
    userName: string,
    profileUrl: string,
  ): Promise<MailSendResult> {
    this.logger.debug(`Enviando correo de bienvenida a ${to}`);

    return this.sendMail({
      to,
      templateName: MailTemplate.WELCOME,
      subject: '¡Bienvenido a CameYo!',
      context: {
        userName,
        profileUrl,
      },
    });
  }

  /**
   * Envía correo para recuperación de contraseña.
   *
   * @param to - Email del destinatario
   * @param userName - Nombre del usuario
   * @param resetLink - Link con token de recuperación
   * @param expirationTime - Tiempo de expiración (ej: "1 hora")
   * @returns MailSendResult
   *
   * @example
   * const result = await mailService.sendResetPasswordEmail(
   *   'user@example.com',
   *   'Juan Pérez',
   *   'https://app.camey.co/reset?token=...',
   *   '1 hora'
   * );
   */
  async sendResetPasswordEmail(
    to: string,
    userName: string,
    resetLink: string,
    expirationTime: string = '1 hora',
  ): Promise<MailSendResult> {
    this.logger.debug(`Enviando reset de contraseña a ${to}`);

    return this.sendMail({
      to,
      templateName: MailTemplate.RESET_PASSWORD,
      subject: 'Recuperar tu contraseña — CameYo',
      context: {
        userName,
        resetLink,
        expirationTime,
      },
    });
  }

  /**
   * Envía correo de confirmación de pago.
   *
   * @param to - Email del destinatario
   * @param userName - Nombre del usuario
   * @param paymentData - Datos del pago (monto, método, referencia, etc)
   * @param dashboardUrl - URL al panel del usuario
   * @returns MailSendResult
   *
   * @example
   * const result = await mailService.sendPaymentConfirmationEmail(
   *   'user@example.com',
   *   'Juan Pérez',
   *   {
   *     amount: '120,000',
   *     paymentMethod: 'Tarjeta de crédito',
   *     transactionId: 'TXN_12345',
   *     paymentDate: '2026-03-17',
   *     paymentTime: '14:30',
   *   },
   *   'https://app.camey.co/dashboard'
   * );
   */
  async sendPaymentConfirmationEmail(
    to: string,
    userName: string,
    paymentData: {
      amount: string;
      paymentMethod: string;
      transactionId: string;
      paymentDate: string;
      paymentTime: string;
    },
    dashboardUrl: string,
  ): Promise<MailSendResult> {
    this.logger.debug(`Enviando confirmación de pago a ${to}`);

    return this.sendMail({
      to,
      templateName: MailTemplate.PAYMENT_CONFIRMATION,
      subject: 'Pago Confirmado — CameYo',
      context: {
        userName,
        ...paymentData,
        dashboardUrl,
      },
    });
  }

  /**
   * Envía notificación genérica.
   *
   * @param to - Email del destinatario (o array de emails)
   * @param userName - Nombre del usuario
   * @param message - Mensaje a mostrar
   * @param options - Opciones adicionales (botón, fecha, etc)
   * @returns MailSendResult
   *
   * @example
   * const result = await mailService.sendNotification(
   *   'user@example.com',
   *   'Juan Pérez',
   *   'Tu solicitud de servicio ha sido aceptada por un técnico.',
   *   {
   *     actionButtonText: 'Ver Detalles',
   *     actionUrl: 'https://app.camey.co/service-request/123',
   *   }
   * );
   */
  async sendNotification(
    to: string | string[],
    userName: string,
    message: string,
    options?: {
      subject?: string;
      actionButtonText?: string;
      actionUrl?: string;
      notificationDate?: string;
      notificationTime?: string;
    },
  ): Promise<MailSendResult> {
    this.logger.debug(`Enviando notificación a ${Array.isArray(to) ? to.join(', ') : to}`);

    return this.sendMail({
      to,
      templateName: MailTemplate.NOTIFICATION,
      subject:
        options?.subject || 'Notificación de CameYo',
      context: {
        userName,
        message,
        actionButtonText: options?.actionButtonText || 'Ver Más',
        actionUrl: options?.actionUrl,
        notificationDate:
          options?.notificationDate ||
          new Date().toLocaleDateString('es-CO'),
        notificationTime:
          options?.notificationTime ||
          new Date().toLocaleTimeString('es-CO'),
      },
    });
  }

  /**
   * Método privado que orquesta el envío real.
   * Traduce opciones de negocio a opciones de transporte.
   */
  private async sendMail(options: SendMailOptions): Promise<MailSendResult> {
    try {
      return await this.nodemailer.sendMail(options);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error inesperado en MailService: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );

      return {
        success: false,
        error: 'Error interno al procesar el correo',
      };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { MailSendResult, MailTemplate, SendMailOptions } from '../domain';
import { NodemailerService } from '../infrastructure';

/**
 * Servicio de Mail - Orquesta el envío de correos a través del módulo de mailer
 *
 * Este servicio proporciona métodos de alto nivel para enviar diferentes tipos
 * de correos (bienvenida, recuperación de contraseña, etc.) con templates
 * predefinidas y manejo automático de errores.
 *
 * @example
 * ```typescript
 * // En un servicio de la aplicación
 * constructor(private mailService: MailService) {}
 *
 * async registerUser(userData: UserData) {
 *   // ... crear usuario...
 *   const result = await this.mailService.sendWelcomeEmail(
 *     userData.email,
 *     userData.name,
 *     profileUrl
 *   );
 *   if (!result.success) {
 *     // Registrar log pero no fallar (envío de email es no crítico)
 *     this.logger.warn(`No se pudo enviar email de bienvenida: ${result.error}`);
 *   }
 * }
 * ```
 */
@Injectable()
export class MailService {
  private readonly logger: Logger = new Logger(MailService.name);
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(private readonly nodemailer: NodemailerService) {}

  /**
   * Valida que un string sea un email válido.
   * @private
   */
  private isValidEmail(email: string): boolean {
    return this.emailRegex.test(email);
  }

  /**
   * Valida un array de emails (string o array de strings).
   * @private
   * @returns Objeto con validación y errores encontrados
   */
  private validateRecipients(to: string | string[]): {
    valid: boolean;
    errors: string[];
  } {
    const emails = Array.isArray(to) ? to : [to];
    const errors: string[] = [];

    for (const email of emails) {
      if (!email || email.trim() === '') {
        errors.push('Email vacío');
      } else if (!this.isValidEmail(email)) {
        errors.push(`Email inválido: ${email}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Método privado que orquesta el envío real.
   * Traduce opciones de negocio a opciones de transporte.
   * Delega el manejo de errores SMTP al NodemailerService.
   *
   * @private
   * @param options - Opciones del correo a enviar
   * @returns MailSendResult con información de éxito/error
   */
  private async sendMail(options: SendMailOptions): Promise<MailSendResult> {
    // Validar recipients antes de intentar enviar
    const recipientValidation = this.validateRecipients(options.to);
    if (!recipientValidation.valid) {
      const errorMsg = recipientValidation.errors.join('; ');
      this.logger.warn(`sendMail: ${errorMsg}`);
      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: errorMsg,
      };
    }

    // Delegar al servicio de infraestructura - el maneja todos los errores SMTP
    // Este try-catch es una capa de seguridad adicional por si el servicio falla inesperadamente
    try {
      return await this.nodemailer.sendMail(options);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error inesperado en sendMail: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
      return {
        success: false,
        errorType: 'UNKNOWN_ERROR',
        error: `Error al enviar el correo: ${errorMessage}`,
      };
    }
  }

  /**
   * Envía correo de bienvenida a un nuevo usuario.
   *
   * @param to - Email del destinatario
   * @param userName - Nombre del usuario
   * @param profileUrl - URL para completar perfil
   * @returns MailSendResult con información de éxito/error
   *
   * @throws No lanza excepciones, retorna error en MailSendResult
   *
   * @example
   * ```typescript
   * const result = await mailService.sendWelcomeEmail(
   *   'user@example.com',
   *   'Juan Pérez',
   *   'https://app.camey.co/complete-profile?token=...'
   * );
   * if (!result.success) {
   *   this.logger.error(`Fallo enviando welcome: ${result.error}`);
   * }
   * ```
   */
  async sendWelcomeEmail(
    to: string,
    userName: string,
    profileUrl: string,
  ): Promise<MailSendResult> {
    // Validaciones básicas
    if (!to || !userName || !profileUrl) {
      const missingFields = [
        !to && 'to',
        !userName && 'userName',
        !profileUrl && 'profileUrl',
      ]
        .filter(Boolean)
        .join(', ');

      this.logger.warn(
        `sendWelcomeEmail: Campos requeridos faltando: ${missingFields}`,
      );

      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: `Campos requeridos faltando: ${missingFields}`,
      };
    }

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
   * @returns MailSendResult con información de éxito/error
   *
   * @example
   * ```typescript
   * const result = await mailService.sendResetPasswordEmail(
   *   'user@example.com',
   *   'Juan Pérez',
   *   'https://app.camey.co/reset?token=...',
   *   '1 hora'
   * );
   * ```
   */
  async sendResetPasswordEmail(
    to: string,
    userName: string,
    resetLink: string,
    expirationTime: string = '1 hora',
  ): Promise<MailSendResult> {
    // Validaciones básicas
    if (!to || !userName || !resetLink) {
      const missingFields = [
        !to && 'to',
        !userName && 'userName',
        !resetLink && 'resetLink',
      ]
        .filter(Boolean)
        .join(', ');

      this.logger.warn(
        `sendResetPasswordEmail: Campos requeridos faltando: ${missingFields}`,
      );

      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: `Campos requeridos faltando: ${missingFields}`,
      };
    }

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
   * @returns MailSendResult con información de éxito/error
   *
   * @example
   * ```typescript
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
   * ```
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
    // Validaciones básicas
    if (!to || !userName || !paymentData || !dashboardUrl) {
      const missingFields = [
        !to && 'to',
        !userName && 'userName',
        !paymentData && 'paymentData',
        !dashboardUrl && 'dashboardUrl',
      ]
        .filter(Boolean)
        .join(', ');

      this.logger.warn(
        `sendPaymentConfirmationEmail: Campos requeridos faltando: ${missingFields}`,
      );

      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: `Campos requeridos faltando: ${missingFields}`,
      };
    }

    // Validar estructura de paymentData
    const requiredPaymentFields = [
      'amount',
      'paymentMethod',
      'transactionId',
      'paymentDate',
      'paymentTime',
    ];
    const missingPaymentFields = requiredPaymentFields.filter(
      (field) => !paymentData[field as keyof typeof paymentData],
    );

    if (missingPaymentFields.length > 0) {
      this.logger.warn(
        `sendPaymentConfirmationEmail: Campos de pago faltando: ${missingPaymentFields.join(', ')}`,
      );

      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: `Campos de pago requeridos faltando: ${missingPaymentFields.join(', ')}`,
      };
    }

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
   * @returns MailSendResult con información de éxito/error
   *
   * @example
   * ```typescript
   * const result = await mailService.sendNotification(
   *   'user@example.com',
   *   'Juan Pérez',
   *   'Tu solicitud de servicio ha sido aceptada por un técnico.',
   *   {
   *     actionButtonText: 'Ver Detalles',
   *     actionUrl: 'https://app.camey.co/service-request/123',
   *   }
   * );
   * ```
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
    // Validaciones básicas
    if (!to || !userName || !message) {
      const missingFields = [
        !to && 'to',
        !userName && 'userName',
        !message && 'message',
      ]
        .filter(Boolean)
        .join(', ');

      this.logger.warn(
        `sendNotification: Campos requeridos faltando: ${missingFields}`,
      );

      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: `Campos requeridos faltando: ${missingFields}`,
      };
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;
    this.logger.debug(`Enviando notificación a ${recipients}`);

    return this.sendMail({
      to,
      templateName: MailTemplate.NOTIFICATION,
      subject: options?.subject || 'Notificación de CameYo',
      context: {
        userName,
        message,
        actionButtonText: options?.actionButtonText || 'Ver Más',
        actionUrl: options?.actionUrl,
        notificationDate:
          options?.notificationDate || new Date().toLocaleDateString('es-CO'),
        notificationTime:
          options?.notificationTime || new Date().toLocaleTimeString('es-CO'),
      },
    });
  }
}

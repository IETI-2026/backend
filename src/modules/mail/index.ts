/**
 * Módulo MailModule
 *
 * Proporciona servicios de correo electrónico reutilizables
 * para toda la aplicación.
 *
 * Características:
 * - Integración Nodemailer + Handlebars
 * - 4 casos de uso predefinidos (welcome, reset password, payment, notification)
 * - Tipado completo con TypeScript
 * - Manejo de errores sin excepciones
 * - Arquitectura hexagonal
 * - Logging y debugging
 *
 * Uso:
 * 1. Importar MailModule en cualquier módulo que necesite enviar correos
 * 2. Inyectar MailService
 * 3. Llamar el método correspondiente (sendWelcomeEmail, sendResetPasswordEmail, etc)
 */

export * from './mail.module';
export * from './application';
export * from './domain';
export * from './infrastructure';

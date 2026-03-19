import { Test, TestingModule } from '@nestjs/testing';
import { MailSendResult, MailTemplate } from '../../domain';
import { NodemailerService } from '../../infrastructure/nodemailer.service';
import { MailService } from '../mail.service';

/**
 * MailService Unit Tests
 *
 * Tests cover:
 * - All 4 semantic send methods
 * - Success and error scenarios
 * - Proper result typing (MailSendResult)
 * - Non-blocking behavior (fire-and-forget)
 */
describe('MailService', () => {
  let service: MailService;
  let mockNodemailer: jest.Mocked<NodemailerService>;

  beforeEach(async () => {
    // Mock NodemailerService
    mockNodemailer = {
      sendMail: jest.fn(),
      verifyConnection: jest.fn(),
    } as jest.Mocked<NodemailerService>;

    // Create Testing Module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: NodemailerService,
          useValue: mockNodemailer,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      // Arrange
      const email = 'user1@example.com';
      const userName = 'Juan Pérez';
      const profileUrl = 'https://app.camey.co/profile';
      const expectedResult: MailSendResult = {
        success: true,
        messageId: 'msg-123',
      };

      mockNodemailer.sendMail.mockResolvedValue(expectedResult);

      // Act
      const result = await service.sendWelcomeEmail(
        email,
        userName,
        profileUrl,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          templateName: MailTemplate.WELCOME,
          subject: '¡Bienvenido a CameYo!',
        }),
      );
    });

    it('should handle send failure gracefully', async () => {
      // Arrange
      const email = 'user2@example.com';
      const errorResult: MailSendResult = {
        success: false,
        error: 'SMTP connection failed',
      };

      mockNodemailer.sendMail.mockResolvedValue(errorResult);

      // Act
      const result = await service.sendWelcomeEmail(
        email,
        'User',
        'https://app.camey.co',
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });
  });

  describe('sendResetPasswordEmail', () => {
    it('should send reset password email successfully', async () => {
      // Arrange
      const email = 'user3@example.com';
      const resetLink = 'https://app.camey.co/reset?token=abc123';
      const expectedResult: MailSendResult = {
        success: true,
        messageId: 'msg-456',
      };

      mockNodemailer.sendMail.mockResolvedValue(expectedResult);

      // Act
      const result = await service.sendResetPasswordEmail(
        email,
        'Juan Pérez',
        resetLink,
        '2 horas',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          templateName: MailTemplate.RESET_PASSWORD,
          subject: 'Recuperar tu contraseña — CameYo',
        }),
      );
    });

    it('should use default expiration time', async () => {
      // Arrange
      mockNodemailer.sendMail.mockResolvedValue({
        success: true,
        messageId: 'msg-789',
      });

      // Act
      await service.sendResetPasswordEmail(
        'user4@example.com',
        'User',
        'https://reset.link',
      );

      // Assert
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            expirationTime: '1 hora',
          }),
        }),
      );
    });
  });

  describe('sendPaymentConfirmationEmail', () => {
    it('should send payment confirmation email successfully', async () => {
      // Arrange
      const email = 'user5@example.com';
      const paymentData = {
        amount: '120,000',
        paymentMethod: 'Tarjeta de crédito',
        transactionId: 'TXN_12345',
        paymentDate: '2026-03-17',
        paymentTime: '14:30',
      };
      const dashboardUrl = 'https://app.camey.co/dashboard';
      const expectedResult: MailSendResult = {
        success: true,
        messageId: 'msg-payment-001',
      };

      mockNodemailer.sendMail.mockResolvedValue(expectedResult);

      // Act
      const result = await service.sendPaymentConfirmationEmail(
        email,
        'Juan Pérez',
        paymentData,
        dashboardUrl,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          templateName: MailTemplate.PAYMENT_CONFIRMATION,
          subject: 'Pago Confirmado — CameYo',
        }),
      );
    });
  });

  describe('sendNotification', () => {
    it('should send generic notification successfully', async () => {
      // Arrange
      const email = 'user6@example.com';
      const message = 'Tu solicitud fue aceptada';
      const expectedResult: MailSendResult = {
        success: true,
        messageId: 'msg-notif-001',
      };

      mockNodemailer.sendMail.mockResolvedValue(expectedResult);

      // Act
      const result = await service.sendNotification(
        email,
        'User Name',
        message,
        {
          actionButtonText: 'Ver Detalles',
          actionUrl: 'https://app.camey.co/details',
        },
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          templateName: MailTemplate.NOTIFICATION,
        }),
      );
    });

    it('should accept multiple recipients', async () => {
      // Arrange
      const emails = ['user11@example.com', 'user22@example.com'];
      mockNodemailer.sendMail.mockResolvedValue({
        success: true,
        messageId: 'msg-bulk',
      });

      // Act
      await service.sendNotification(emails, 'User', 'Hello all');

      // Assert
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: emails,
        }),
      );
    });

    it('should use custom subject when provided', async () => {
      // Arrange
      mockNodemailer.sendMail.mockResolvedValue({
        success: true,
        messageId: 'msg-notif-002',
      });

      // Act
      await service.sendNotification('user11@example.com', 'User', 'Message', {
        subject: 'Asunto Personalizado',
      });

      // Assert
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Asunto Personalizado',
        }),
      );
    });

    it('should use default subject when not provided', async () => {
      // Arrange
      mockNodemailer.sendMail.mockResolvedValue({
        success: true,
        messageId: 'msg-notif-003',
      });

      // Act
      await service.sendNotification('user33@example.com', 'User', 'Message');

      // Assert
      expect(mockNodemailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Notificación de CameYo',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should return error result when NodemailerService fails', async () => {
      // Arrange
      mockNodemailer.sendMail.mockResolvedValue({
        success: false,
        error: 'Connection timeout',
      });

      // Act
      const result = await service.sendWelcomeEmail(
        'user44@example.com',
        'User',
        'https://url.com',
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
    });

    it('should not throw exceptions', async () => {
      // Arrange
      mockNodemailer.sendMail.mockRejectedValue(new Error('Unexpected error'));

      // Act & Assert
      await expect(
        service.sendWelcomeEmail('user@example.com', 'User', 'https://url'),
      ).resolves.toBeDefined();
    });
  });

  describe('Result Type Compliance', () => {
    it('always returns MailSendResult with proper type', async () => {
      // This test verifies TypeScript typing is correct
      mockNodemailer.sendMail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      });

      const result = await service.sendWelcomeEmail(
        'user55@example.com',
        'User',
        'https://url',
      );

      // Assert result matches MailSendResult interface
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(typeof result.messageId).toBe('string');
      } else {
        expect(typeof result.error).toBe('string');
      }
    });
  });
});

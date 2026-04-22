import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailTemplate } from '../../domain';
import { NodemailerService } from '../nodemailer.service';

describe('NodemailerService', () => {
  let service: NodemailerService;
  let mailerService: jest.Mocked<MailerService>;
  let configService: jest.Mocked<ConfigService>;

  const mailConfig = { mailFrom: 'noreply@camey.co' };

  beforeEach(async () => {
    mailerService = {
      sendMail: jest.fn(),
    } as unknown as jest.Mocked<MailerService>;
    configService = {
      get: jest.fn().mockReturnValue(mailConfig),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: MailerService, useValue: mailerService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(NodemailerService);
  });

  describe('sendMail', () => {
    it('should send mail successfully and return success result', async () => {
      mailerService.sendMail.mockResolvedValue({ messageId: 'msg-001' });

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
        subject: 'Welcome',
        context: { userName: 'Test' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-001');
    });

    it('should return VALIDATION_ERROR when to is missing', async () => {
      const result = await service.sendMail({
        to: '',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR when templateName is missing', async () => {
      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: '' as MailTemplate,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('VALIDATION_ERROR');
    });

    it('should classify AUTH_ERROR for EAUTH errors', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('EAUTH authentication failed 535'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('AUTH_ERROR');
    });

    it('should classify CONNECTION_ERROR for ECONNREFUSED', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('ECONNREFUSED connection refused'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('CONNECTION_ERROR');
    });

    it('should classify TIMEOUT_ERROR for timeout errors', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('connection timed out ETIMEDOUT'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('TIMEOUT_ERROR');
    });

    it('should classify TEMPLATE_ERROR for template not found', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('template not found path enoent'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('TEMPLATE_ERROR');
    });

    it('should classify NETWORK_ERROR for DNS errors', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND dns error'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('NETWORK_ERROR');
    });

    it('should classify SSL_ERROR for TLS errors', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('ssl certificate error tls'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('SSL_ERROR');
    });

    it('should classify SMTP_ERROR for generic smtp error', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('smtp server rejected'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('SMTP_ERROR');
    });

    it('should classify UNKNOWN_ERROR for unrecognized errors', async () => {
      mailerService.sendMail.mockRejectedValue(
        new Error('some random failure'),
      );

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('UNKNOWN_ERROR');
    });

    it('should handle non-Error thrown values', async () => {
      mailerService.sendMail.mockRejectedValue('string-error');

      const result = await service.sendMail({
        to: 'user@example.com',
        templateName: MailTemplate.WELCOME,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('UNKNOWN_ERROR');
    });

    it('should accept array of recipients', async () => {
      mailerService.sendMail.mockResolvedValue({ messageId: 'msg-bulk' });

      const result = await service.sendMail({
        to: ['a@example.com', 'b@example.com'],
        templateName: MailTemplate.NOTIFICATION,
        subject: 'Hello all',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('verifyConnection', () => {
    it('should return true when transporter verify succeeds', async () => {
      const mockTransporter = { verify: jest.fn().mockResolvedValue(true) };
      (mailerService as unknown as Record<string, unknown>).transporter =
        mockTransporter;

      const result = await service.verifyConnection();

      expect(result).toBe(true);
    });

    it('should return false when transporter is not available', async () => {
      const result = await service.verifyConnection();

      expect(result).toBe(false);
    });

    it('should return false when verify throws', async () => {
      const mockTransporter = {
        verify: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };
      (mailerService as unknown as Record<string, unknown>).transporter =
        mockTransporter;

      const result = await service.verifyConnection();

      expect(result).toBe(false);
    });
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import {
  PaymentEntity,
  ServiceRequestEntity,
  UserEntity,
  UserPaymentMethodEntity,
} from '@/database/entities';
import {
  PaymentMethodType,
  PaymentStatus,
  RoleName,
  ServiceRequestStatus,
} from '@/database/enums';
import { TENANT_DATA_SOURCE, TenantDataSourceService } from '@/tenant';
import { MailService } from '../../../mail/application/mail.service';
import { ServiceRequestsGateway } from '../../../service-requests/presentation/gateways/service-requests.gateway';
import {
  CreatePaymentDto,
  CreatePaymentMethodDto,
  PaymentsService,
  UpdatePaymentStatusDto,
} from '../../application';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: jest.Mocked<Repository<PaymentEntity>>;
  let paymentMethodRepository: jest.Mocked<Repository<UserPaymentMethodEntity>>;
  let serviceRequestRepository: jest.Mocked<Repository<ServiceRequestEntity>>;
  let userRepository: jest.Mocked<Repository<UserEntity>>;
  let gateway: jest.Mocked<ServiceRequestsGateway>;
  let mailService: jest.Mocked<MailService>;

  const mockUserId = 'user-123';
  const mockProviderId = 'provider-456';
  const mockRequestId = 'request-789';
  const mockPaymentMethodId = 'method-101';
  const mockPaymentId = 'payment-202';

  const mockUser = {
    id: mockUserId,
    email: 'user@example.com',
    fullName: 'Test User',
    primaryRole: RoleName.USER,
  } as UserEntity;

  const mockProvider = {
    id: mockProviderId,
    email: 'provider@example.com',
    primaryRole: RoleName.PROVIDER,
  } as UserEntity;

  const mockServiceRequest = {
    id: mockRequestId,
    userId: mockUserId,
    status: ServiceRequestStatus.COMPLETED,
  } as ServiceRequestEntity;

  const mockPaymentMethod = {
    id: mockPaymentMethodId,
    userId: mockUserId,
    methodType: PaymentMethodType.NEQUI,
    accountIdentifier: '3001234567',
    isActive: true,
    isDefault: true,
    forRole: RoleName.USER,
    createdAt: new Date(),
  } as unknown as UserPaymentMethodEntity;

  const mockPayment = {
    id: mockPaymentId,
    userId: mockUserId,
    serviceRequestId: mockRequestId,
    paymentMethod: PaymentMethodType.NEQUI,
    grossAmount: '100',
    commissionRate: 0.1,
    commissionAmount: '10',
    netAmount: '90',
    status: PaymentStatus.PENDING,
    createdAt: new Date(),
  } as unknown as PaymentEntity;

  beforeEach(async () => {
    paymentRepository = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<PaymentEntity>>;

    paymentMethodRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserPaymentMethodEntity>>;

    serviceRequestRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<ServiceRequestEntity>>;

    userRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserEntity>>;

    gateway = {
      emitPaymentCompleted: jest.fn(),
    } as unknown as jest.Mocked<ServiceRequestsGateway>;

    mailService = {
      sendPaymentConfirmationEmail: jest
        .fn()
        .mockResolvedValue({ success: true }),
    } as unknown as jest.Mocked<MailService>;

    const mockTenantDataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PaymentEntity) return paymentRepository;
        if (entity === UserPaymentMethodEntity) return paymentMethodRepository;
        if (entity === ServiceRequestEntity) return serviceRequestRepository;
        if (entity === UserEntity) return userRepository;
        return {};
      }),
    } as unknown as DataSource;

    const mockPublicDataSource = {
      getRepository: jest.fn().mockReturnValue(userRepository),
    } as unknown as DataSource;

    const mockTenantDataSourceService = {
      getDataSource: jest.fn().mockResolvedValue(mockPublicDataSource),
    } as unknown as TenantDataSourceService;

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'epayco.customerId') return 'test-customer-id';
        if (key === 'epayco.privateKey') return 'test-private-key';
        return undefined;
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: TENANT_DATA_SOURCE, useValue: mockTenantDataSource },
        {
          provide: TenantDataSourceService,
          useValue: mockTenantDataSourceService,
        },
        { provide: ServiceRequestsGateway, useValue: gateway },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('getAvailableMethodsForUser', () => {
    it('should return available methods for regular user', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getAvailableMethodsForUser(mockUserId);

      expect(result).toContain(PaymentMethodType.EPAYCO);
      expect(result).toContain(PaymentMethodType.NEQUI);
      expect(result).toContain(PaymentMethodType.DAVIPLATA);
      expect(result).toContain(PaymentMethodType.CASH);
      expect(result).not.toContain(PaymentMethodType.BANK_TRANSFER);
      expect(result.length).toBe(4);
    });

    it('should return available methods including BANK_TRANSFER for provider', async () => {
      userRepository.findOne.mockResolvedValue(mockProvider);

      const result = await service.getAvailableMethodsForUser(mockProviderId);

      expect(result).toContain(PaymentMethodType.EPAYCO);
      expect(result).toContain(PaymentMethodType.NEQUI);
      expect(result).toContain(PaymentMethodType.DAVIPLATA);
      expect(result).toContain(PaymentMethodType.CASH);
      expect(result).toContain(PaymentMethodType.BANK_TRANSFER);
      expect(result.length).toBe(5);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAvailableMethodsForUser(mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyPaymentMethods', () => {
    it('should return user payment methods', async () => {
      paymentMethodRepository.find.mockResolvedValue([mockPaymentMethod]);

      const result = await service.getMyPaymentMethods(mockUserId);

      expect(result).toEqual([mockPaymentMethod]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should query with correct filters and ordering', async () => {
      paymentMethodRepository.find.mockResolvedValue([]);

      await service.getMyPaymentMethods(mockUserId);

      expect(paymentMethodRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId, isActive: true },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
    });

    it('should return empty array when user has no payment methods', async () => {
      paymentMethodRepository.find.mockResolvedValue([]);

      const result = await service.getMyPaymentMethods(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('createPaymentMethod', () => {
    it('should create a new payment method', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      paymentMethodRepository.create.mockReturnValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.NEQUI,
        accountIdentifier: '3001234567',
        isDefault: false,
      };

      const result = await service.createPaymentMethod(mockUserId, dto);

      expect(result).toEqual(mockPaymentMethod);
    });

    it('should require accountIdentifier for non-CASH methods', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.NEQUI,
        accountIdentifier: '',
        isDefault: false,
      };

      await expect(
        service.createPaymentMethod(mockUserId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not require accountIdentifier for CASH method', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      const cashMethod = {
        ...mockPaymentMethod,
        methodType: PaymentMethodType.CASH,
        accountIdentifier: null,
      } as unknown as UserPaymentMethodEntity;
      paymentMethodRepository.create.mockReturnValue(cashMethod);
      paymentMethodRepository.save.mockResolvedValue(cashMethod);

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.CASH,
        isDefault: false,
      };

      const result = await service.createPaymentMethod(mockUserId, dto);

      expect(result.methodType).toBe(PaymentMethodType.CASH);
    });

    it('should unset other default methods when isDefault is true', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      paymentMethodRepository.create.mockReturnValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.NEQUI,
        accountIdentifier: '3001234567',
        isDefault: true,
      };

      await service.createPaymentMethod(mockUserId, dto);

      expect(paymentMethodRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.NEQUI,
        accountIdentifier: '3001234567',
        isDefault: false,
      };

      await expect(
        service.createPaymentMethod(mockUserId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set forRole to user primaryRole if not provided', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      paymentMethodRepository.create.mockReturnValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.NEQUI,
        accountIdentifier: '3001234567',
        isDefault: false,
      };

      await service.createPaymentMethod(mockUserId, dto);

      expect(paymentMethodRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          methodType: PaymentMethodType.NEQUI,
          forRole: mockUser.primaryRole,
        }),
      );
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set payment method as default', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        isDefault: true,
      } as unknown as UserPaymentMethodEntity);

      const result = await service.setDefaultPaymentMethod(
        mockUserId,
        mockPaymentMethodId,
      );

      expect(result.isDefault).toBe(true);
    });

    it('should throw NotFoundException when payment method not found', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.setDefaultPaymentMethod(mockUserId, 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query with correct filters', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      await service.setDefaultPaymentMethod(mockUserId, mockPaymentMethodId);

      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockPaymentMethodId,
          userId: mockUserId,
          isActive: true,
        },
      });
    });
  });

  describe('disablePaymentMethod', () => {
    it('should disable a payment method', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        isActive: false,
        isDefault: false,
      });

      await service.disablePaymentMethod(mockUserId, mockPaymentMethodId);

      expect(paymentMethodRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          isDefault: false,
        }),
      );
    });

    it('should throw NotFoundException when payment method not found', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.disablePaymentMethod(mockUserId, 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyPayments', () => {
    it('should return user payments', async () => {
      paymentRepository.find.mockResolvedValue([mockPayment]);

      const result = await service.getMyPayments(mockUserId);

      expect(result).toEqual([mockPayment]);
    });

    it('should query with correct filters and ordering', async () => {
      paymentRepository.find.mockResolvedValue([]);

      await service.getMyPayments(mockUserId);

      expect(paymentRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        relations: ['serviceRequest'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when user has no payments', async () => {
      paymentRepository.find.mockResolvedValue([]);

      const result = await service.getMyPayments(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      const result = await service.createPayment(mockUserId, dto);

      expect(result).toBeDefined();
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when service request belongs to different user', async () => {
      const otherUserRequest = { ...mockServiceRequest, userId: 'other-user' };
      serviceRequestRepository.findOne.mockResolvedValue(otherUserRequest);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      await expect(service.createPayment(mockUserId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when payment already exists for request', async () => {
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      await expect(service.createPayment(mockUserId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should set status to PENDING for CASH payment', async () => {
      const cashPaymentMethod = {
        ...mockPaymentMethod,
        methodType: PaymentMethodType.CASH,
      };
      const cashPayment = {
        ...mockPayment,
        paymentMethod: PaymentMethodType.CASH,
        status: PaymentStatus.PENDING,
      } as unknown as PaymentEntity;
      userRepository.findOne.mockResolvedValue(mockUser);
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentMethodRepository.findOne.mockResolvedValue(cashPaymentMethod);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(cashPayment);
      paymentRepository.save.mockResolvedValue(cashPayment);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.CASH,
        grossAmount: 100,
        commissionRate: 0,
      };

      await service.createPayment(mockUserId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PENDING,
        }),
      );
    });

    it('should set status to PROCESSING for non-CASH payment', async () => {
      const processingPayment = {
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      } as unknown as PaymentEntity;
      userRepository.findOne.mockResolvedValue(mockUser);
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(processingPayment);
      paymentRepository.save.mockResolvedValue(processingPayment);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      await service.createPayment(mockUserId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PROCESSING,
        }),
      );
    });

    it('should calculate net amount correctly', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockImplementation(
        (obj) => obj as unknown as PaymentEntity,
      );
      paymentRepository.save.mockImplementation((obj) =>
        Promise.resolve(obj as unknown as PaymentEntity),
      );

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 1000,
        commissionRate: 0.05,
      };

      await service.createPayment(mockUserId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          grossAmount: '1000.00',
          commissionAmount: '50.00',
          netAmount: '950.00',
        }),
      );
    });

    it('should throw NotFoundException when service request not found', async () => {
      serviceRequestRepository.findOne.mockResolvedValue(null);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      await expect(service.createPayment(mockUserId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status to COMPLETED', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);
      paymentRepository.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
      };

      const result = await service.updatePaymentStatus(
        mockUserId,
        mockPaymentId,
        dto,
      );

      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should update payment status to REFUNDED with reason', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      paymentRepository.findOne.mockResolvedValue(completedPayment);
      paymentRepository.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundReason: 'Customer request',
      } as unknown as PaymentEntity);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.REFUNDED,
        reason: 'Customer request',
      };

      await service.updatePaymentStatus(mockUserId, mockPaymentId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundReason: 'Customer request',
        }),
      );
    });

    it('should update payment status to FAILED with reason', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.save.mockResolvedValue({
        ...pendingPayment,
        status: PaymentStatus.FAILED,
        refundReason: 'Insufficient funds',
      } as unknown as PaymentEntity);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.FAILED,
        reason: 'Insufficient funds',
      };

      await service.updatePaymentStatus(mockUserId, mockPaymentId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.FAILED,
          refundReason: 'Insufficient funds',
        }),
      );
    });

    it('should throw ForbiddenException when payment belongs to different user', async () => {
      const otherUserPayment = { ...mockPayment, userId: 'other-user' };
      paymentRepository.findOne.mockResolvedValue(otherUserPayment);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
      };

      await expect(
        service.updatePaymentStatus(mockUserId, mockPaymentId, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
      };

      await expect(
        service.updatePaymentStatus(mockUserId, 'invalid-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update receipt URL if provided', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.save.mockResolvedValue({
        ...pendingPayment,
        status: PaymentStatus.COMPLETED,
        receiptUrl: 'https://example.com/receipt.pdf',
      });

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
        receiptUrl: 'https://example.com/receipt.pdf',
      };

      await service.updatePaymentStatus(mockUserId, mockPaymentId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          receiptUrl: 'https://example.com/receipt.pdf',
        }),
      );
    });

    it('should set paidAt when status is COMPLETED', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      paymentRepository.findOne.mockResolvedValue(pendingPayment);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
      };

      await service.updatePaymentStatus(mockUserId, mockPaymentId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          paidAt: expect.any(Date),
        }),
      );
    });

    it('should set refundedAt when status is REFUNDED', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      paymentRepository.findOne.mockResolvedValue(completedPayment);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.REFUNDED,
      };

      await service.updatePaymentStatus(mockUserId, mockPaymentId, dto);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('getPaymentByServiceRequest', () => {
    it('should return payment for service request owner', async () => {
      serviceRequestRepository.findOne.mockResolvedValue({
        id: mockRequestId,
        userId: mockUserId,
        assignedTechnicianId: mockProviderId,
      });
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByServiceRequest(
        mockRequestId,
        mockUserId,
      );

      expect(result).toEqual(mockPayment);
    });

    it('should return payment for assigned technician', async () => {
      serviceRequestRepository.findOne.mockResolvedValue({
        id: mockRequestId,
        userId: mockUserId,
        assignedTechnicianId: mockProviderId,
      });
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByServiceRequest(
        mockRequestId,
        mockProviderId,
      );

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when service request does not exist', async () => {
      serviceRequestRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentByServiceRequest(mockRequestId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is neither owner nor technician', async () => {
      serviceRequestRepository.findOne.mockResolvedValue({
        id: mockRequestId,
        userId: 'other-user',
        assignedTechnicianId: 'other-tech',
      });

      await expect(
        service.getPaymentByServiceRequest(mockRequestId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when no payment exists for the service request', async () => {
      serviceRequestRepository.findOne.mockResolvedValue({
        id: mockRequestId,
        userId: mockUserId,
        assignedTechnicianId: null,
      });
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentByServiceRequest(mockRequestId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processEpaycoWebhook', () => {
    // sha256('test-customer-id^test-private-key^ref-12345^txn-001^100000^COP^NEQUI^<response>')
    const SIG_COMPLETED =
      'a98e2ec6278005d014358f6a4206907965c284d786d29261ee691ad632b02773';
    const SIG_FAILED =
      'a107072535c3e48d236ec870f2c56b54b9892226dcd1b71d0f9111ba331209fd';
    const SIG_REFUNDED =
      '20f1bf0f7aa0ad3c2b656415613ad6c9f7df243c03aecf0a1c68f09910625cb0';

    const baseDto = {
      x_ref_payco: 'ref-12345',
      x_transaction_id: 'txn-001',
      x_amount: '100000',
      x_currency_code: 'COP',
      x_franchise: 'NEQUI',
      x_extra1: mockPaymentId,
    };

    it('should process webhook and mark payment COMPLETED when response is "1"', async () => {
      const dto = { ...baseDto, x_response: '1', x_signature: SIG_COMPLETED };
      paymentRepository.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      });
      paymentRepository.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });
      gateway.emitPaymentCompleted.mockReturnValue(undefined);

      const result = await service.processEpaycoWebhook(dto as unknown);

      expect(result).toEqual({ received: true });
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should reject when signature is invalid (wrong hash)', async () => {
      const dto = { ...baseDto, x_response: '1', x_signature: 'bad-sig' };

      let threw = false;
      try {
        await service.processEpaycoWebhook(dto as unknown);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(UnauthorizedException);
      }
      expect(threw).toBe(true);
    });

    it('should reject when x_signature field is absent', async () => {
      const dto = { ...baseDto, x_response: '1' };

      let threw = false;
      try {
        await service.processEpaycoWebhook(dto as unknown);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(UnauthorizedException);
      }
      expect(threw).toBe(true);
    });

    it('should return received:true when no payment found for the reference', async () => {
      const dto = {
        ...baseDto,
        x_response: '1',
        x_signature: SIG_COMPLETED,
        x_extra1: undefined,
      };
      paymentRepository.findOne.mockResolvedValue(null);

      const result = await service.processEpaycoWebhook(dto as unknown);

      expect(result).toEqual({ received: true });
    });

    it('should return received:true when state transition is not allowed', async () => {
      const dto = { ...baseDto, x_response: '1', x_signature: SIG_COMPLETED };
      paymentRepository.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.processEpaycoWebhook(dto as unknown);

      expect(result).toEqual({ received: true });
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('should mark payment FAILED when response is "2"', async () => {
      const dto = { ...baseDto, x_response: '2', x_signature: SIG_FAILED };
      const failedPayment = {
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      };
      paymentRepository.findOne.mockResolvedValue(failedPayment);
      paymentRepository.save.mockResolvedValue({
        ...failedPayment,
        status: PaymentStatus.FAILED,
      });
      gateway.emitPaymentCompleted.mockReturnValue(undefined);

      const result = await service.processEpaycoWebhook(dto as unknown);

      expect(result).toEqual({ received: true });
    });

    it('should mark payment REFUNDED when response is "6"', async () => {
      const dto = { ...baseDto, x_response: '6', x_signature: SIG_REFUNDED };
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      paymentRepository.findOne.mockResolvedValue(completedPayment);
      paymentRepository.save.mockResolvedValue({
        ...completedPayment,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
      });
      gateway.emitPaymentCompleted.mockReturnValue(undefined);

      const result = await service.processEpaycoWebhook(dto as unknown);

      expect(result).toEqual({ received: true });
    });
  });

  describe('createPayment — additional edge cases', () => {
    it('should throw UnprocessableEntityException when service is not COMPLETED', async () => {
      serviceRequestRepository.findOne.mockResolvedValue({
        ...mockServiceRequest,
        status: ServiceRequestStatus.REQUESTED,
      });

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      await expect(service.createPayment(mockUserId, dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw BadRequestException when no payment method is provided', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentRepository.findOne.mockResolvedValue(null);

      const dto = {
        serviceRequestId: mockRequestId,
        grossAmount: 100,
        commissionRate: 0.1,
      } as unknown as CreatePaymentDto;

      await expect(service.createPayment(mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return existing payment when it is already COMPLETED (idempotent)', async () => {
      serviceRequestRepository.findOne.mockResolvedValue(mockServiceRequest);
      paymentRepository.findOne
        .mockResolvedValueOnce({
          ...mockPayment,
          status: PaymentStatus.COMPLETED,
        })
        .mockResolvedValue(mockPayment);
      paymentRepository.findOneOrFail = jest
        .fn()
        .mockResolvedValue(mockPayment);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      const result = await service.createPayment(mockUserId, dto);

      expect(result).toBeDefined();
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus — transition validation', () => {
    it('should throw UnprocessableEntityException for disallowed transition', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        userId: mockUserId,
      };
      paymentRepository.findOne.mockResolvedValue(completedPayment);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.PENDING,
      };

      await expect(
        service.updatePaymentStatus(mockUserId, mockPaymentId, dto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should emit payment event when status becomes CANCELLED', async () => {
      const pendingPayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
        userId: mockUserId,
      };
      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.save.mockResolvedValue({
        ...pendingPayment,
        status: PaymentStatus.CANCELLED,
      });
      gateway.emitPaymentCompleted.mockReturnValue(undefined);

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.CANCELLED,
      };

      await service.updatePaymentStatus(mockUserId, mockPaymentId, dto);

      expect(gateway.emitPaymentCompleted).toHaveBeenCalled();
    });
  });
});

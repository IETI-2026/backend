import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  const mockUserId = 'user-123';
  const mockProviderId = 'provider-456';
  const mockRequestId = 'request-789';
  const mockPaymentMethodId = 'method-101';
  const mockPaymentId = 'payment-202';

  const mockUser = {
    id: mockUserId,
    email: 'user@example.com',
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
    process.env.EPAYCO_P_CUST_ID = 'test-customer-id';
    process.env.EPAYCO_P_KEY = 'test-private-key';

    paymentRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: paymentRepository,
        },
        {
          provide: getRepositoryToken(UserPaymentMethodEntity),
          useValue: paymentMethodRepository,
        },
        {
          provide: getRepositoryToken(ServiceRequestEntity),
          useValue: serviceRequestRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: ServiceRequestsGateway,
          useValue: gateway,
        },
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

    it('should query user repository with correct where clause', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await service.getAvailableMethodsForUser(mockUserId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
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
      const existingDefault = { ...mockPaymentMethod, isDefault: true };
      paymentMethodRepository.find.mockResolvedValue([existingDefault]);
      paymentMethodRepository.create.mockReturnValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.update = jest.fn().mockResolvedValue({});

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

      const _result = await service.createPayment(mockUserId, dto);

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

      const _result = await service.createPayment(mockUserId, dto);

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
});

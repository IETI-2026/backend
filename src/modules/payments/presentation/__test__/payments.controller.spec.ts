import { Test, TestingModule } from '@nestjs/testing';
import { PaymentEntity, UserPaymentMethodEntity } from '@/database/entities';
import { PaymentMethodType, PaymentStatus, RoleName } from '@/database/enums';
import { JwtPayloadEntity } from '../../../auth/domain/entities';
import {
  CreatePaymentDto,
  CreatePaymentMethodDto,
  PaymentsService,
  UpdatePaymentStatusDto,
} from '../../application';
import { PaymentsController } from '../payments.controller';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockUserId = 'user-123';
  const mockProviderId = 'provider-456';
  const mockPaymentMethodId = 'method-101';
  const mockPaymentId = 'payment-202';
  const mockRequestId = 'request-789';

  const mockUser: JwtPayloadEntity = {
    sub: mockUserId,
    email: 'user@example.com',
    roles: [RoleName.USER],
  } as unknown as JwtPayloadEntity;

  const mockProvider: JwtPayloadEntity = {
    sub: mockProviderId,
    email: 'provider@example.com',
    roles: [RoleName.PROVIDER],
  } as unknown as JwtPayloadEntity;

  const mockPaymentMethod: UserPaymentMethodEntity = {
    id: mockPaymentMethodId,
    userId: mockUserId,
    methodType: PaymentMethodType.NEQUI,
    accountIdentifier: '3001234567',
    isActive: true,
    isDefault: true,
    forRole: RoleName.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as UserPaymentMethodEntity;

  const mockPayment: PaymentEntity = {
    id: mockPaymentId,
    userId: mockUserId,
    serviceRequestId: mockRequestId,
    paymentMethod: PaymentMethodType.NEQUI,
    grossAmount: '100.00',
    commissionRate: 0.1,
    commissionAmount: '10.00',
    netAmount: '90.00',
    status: PaymentStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as PaymentEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            getAvailableMethodsForUser: jest.fn(),
            getMyPaymentMethods: jest.fn(),
            createPaymentMethod: jest.fn(),
            setDefaultPaymentMethod: jest.fn(),
            disablePaymentMethod: jest.fn(),
            getMyPayments: jest.fn(),
            createPayment: jest.fn(),
            updatePaymentStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PaymentsController);
    paymentsService = module.get(
      PaymentsService,
    ) as jest.Mocked<PaymentsService>;
  });

  describe('getAvailableMethods', () => {
    it('should return available payment methods for user', async () => {
      const availableMethods = [
        PaymentMethodType.EPAYCO,
        PaymentMethodType.NEQUI,
        PaymentMethodType.DAVIPLATA,
        PaymentMethodType.CASH,
      ];
      paymentsService.getAvailableMethodsForUser.mockResolvedValue(
        availableMethods,
      );

      const result = await controller.getAvailableMethods(mockUser);

      expect(result).toEqual(availableMethods);
      expect(paymentsService.getAvailableMethodsForUser).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should return available methods including BANK_TRANSFER for provider', async () => {
      const availableMethods = [
        PaymentMethodType.EPAYCO,
        PaymentMethodType.NEQUI,
        PaymentMethodType.DAVIPLATA,
        PaymentMethodType.CASH,
        PaymentMethodType.BANK_TRANSFER,
      ];
      paymentsService.getAvailableMethodsForUser.mockResolvedValue(
        availableMethods,
      );

      const result = await controller.getAvailableMethods(mockProvider);

      expect(result).toHaveLength(5);
      expect(result).toContain(PaymentMethodType.BANK_TRANSFER);
    });
  });

  describe('getMyMethods', () => {
    it('should return user payment methods', async () => {
      paymentsService.getMyPaymentMethods.mockResolvedValue([
        mockPaymentMethod,
      ]);

      const result = await controller.getMyMethods(mockUser);

      expect(result).toEqual([mockPaymentMethod]);
      expect(paymentsService.getMyPaymentMethods).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should return empty array when user has no payment methods', async () => {
      paymentsService.getMyPaymentMethods.mockResolvedValue([]);

      const result = await controller.getMyMethods(mockUser);

      expect(result).toEqual([]);
    });
  });

  describe('createMethod', () => {
    it('should create a new payment method', async () => {
      paymentsService.createPaymentMethod.mockResolvedValue(mockPaymentMethod);

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.NEQUI,
        accountIdentifier: '3001234567',
        isDefault: false,
      };

      const result = await controller.createMethod(mockUser, dto);

      expect(result).toEqual(mockPaymentMethod);
      expect(paymentsService.createPaymentMethod).toHaveBeenCalledWith(
        mockUserId,
        dto,
      );
    });

    it('should create CASH payment method without accountIdentifier', async () => {
      const cashMethod = {
        ...mockPaymentMethod,
        methodType: PaymentMethodType.CASH,
        accountIdentifier: null,
      };
      paymentsService.createPaymentMethod.mockResolvedValue(
        cashMethod as unknown as UserPaymentMethodEntity,
      );

      const dto: CreatePaymentMethodDto = {
        methodType: PaymentMethodType.CASH,
        isDefault: false,
      };

      const result = await controller.createMethod(mockUser, dto);

      expect(result.methodType).toBe(PaymentMethodType.CASH);
    });
  });

  describe('setDefaultMethod', () => {
    it('should set payment method as default', async () => {
      const defaultMethod = {
        ...mockPaymentMethod,
        isDefault: true,
      };
      paymentsService.setDefaultPaymentMethod.mockResolvedValue(
        defaultMethod as unknown as UserPaymentMethodEntity,
      );

      const result = await controller.setDefaultMethod(
        mockUser,
        mockPaymentMethodId,
      );

      expect(result.isDefault).toBe(true);
      expect(paymentsService.setDefaultPaymentMethod).toHaveBeenCalledWith(
        mockUserId,
        mockPaymentMethodId,
      );
    });
  });

  describe('deleteMethod', () => {
    it('should disable payment method', async () => {
      paymentsService.disablePaymentMethod.mockResolvedValue(undefined);

      await controller.deleteMethod(mockUser, mockPaymentMethodId);

      expect(paymentsService.disablePaymentMethod).toHaveBeenCalledWith(
        mockUserId,
        mockPaymentMethodId,
      );
    });

    it('should return void', async () => {
      paymentsService.disablePaymentMethod.mockResolvedValue(undefined);

      const result = await controller.deleteMethod(
        mockUser,
        mockPaymentMethodId,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('getMyPayments', () => {
    it('should return user payments', async () => {
      paymentsService.getMyPayments.mockResolvedValue([mockPayment]);

      const result = await controller.getMyPayments(mockUser);

      expect(result).toEqual([mockPayment]);
      expect(paymentsService.getMyPayments).toHaveBeenCalledWith(mockUserId);
    });

    it('should return empty array when user has no payments', async () => {
      paymentsService.getMyPayments.mockResolvedValue([]);

      const result = await controller.getMyPayments(mockUser);

      expect(result).toEqual([]);
    });

    it('should return multiple payments', async () => {
      const payment2 = { ...mockPayment, id: 'payment-303' };
      paymentsService.getMyPayments.mockResolvedValue([
        mockPayment,
        payment2 as unknown as PaymentEntity,
      ]);

      const result = await controller.getMyPayments(mockUser);

      expect(result).toHaveLength(2);
    });
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      paymentsService.createPayment.mockResolvedValue(mockPayment);

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      const result = await controller.createPayment(mockUser, dto);

      expect(result).toEqual(mockPayment);
      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        mockUserId,
        dto,
      );
    });

    it('should handle CASH payment creation', async () => {
      const cashPayment = {
        ...mockPayment,
        paymentMethod: PaymentMethodType.CASH,
        status: PaymentStatus.PENDING,
      };
      paymentsService.createPayment.mockResolvedValue(
        cashPayment as unknown as PaymentEntity,
      );

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.CASH,
        grossAmount: 100,
        commissionRate: 0,
      };

      const result = await controller.createPayment(mockUser, dto);

      expect(result.paymentMethod).toBe(PaymentMethodType.CASH);
    });

    it('should handle provider creating payment', async () => {
      const providerPayment = {
        ...mockPayment,
        userId: mockProviderId,
      };
      paymentsService.createPayment.mockResolvedValue(
        providerPayment as unknown as PaymentEntity,
      );

      const dto: CreatePaymentDto = {
        serviceRequestId: mockRequestId,
        paymentMethod: PaymentMethodType.NEQUI,
        grossAmount: 100,
        commissionRate: 0.1,
      };

      await controller.createPayment(mockProvider, dto);

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        mockProviderId,
        dto,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update payment status to COMPLETED', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      };
      paymentsService.updatePaymentStatus.mockResolvedValue(
        completedPayment as unknown as PaymentEntity,
      );

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
      };

      const result = await controller.updateStatus(
        mockUser,
        mockPaymentId,
        dto,
      );

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(paymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockUserId,
        mockPaymentId,
        dto,
      );
    });

    it('should update payment status to REFUNDED with reason', async () => {
      const refundedPayment = {
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundReason: 'Customer request',
      };
      paymentsService.updatePaymentStatus.mockResolvedValue(
        refundedPayment as unknown as PaymentEntity,
      );

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.REFUNDED,
        reason: 'Customer request',
      };

      const result = await controller.updateStatus(
        mockUser,
        mockPaymentId,
        dto,
      );

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(result.refundReason).toBe('Customer request');
    });

    it('should update payment status to FAILED with reason', async () => {
      const failedPayment = {
        ...mockPayment,
        status: PaymentStatus.FAILED,
        refundReason: 'Insufficient funds',
      };
      paymentsService.updatePaymentStatus.mockResolvedValue(
        failedPayment as unknown as PaymentEntity,
      );

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.FAILED,
        reason: 'Insufficient funds',
      };

      const result = await controller.updateStatus(
        mockUser,
        mockPaymentId,
        dto,
      );

      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it('should update receipt URL if provided', async () => {
      const paymentWithReceipt = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        receiptUrl: 'https://example.com/receipt.pdf',
      };
      paymentsService.updatePaymentStatus.mockResolvedValue(
        paymentWithReceipt as unknown as PaymentEntity,
      );

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
        receiptUrl: 'https://example.com/receipt.pdf',
      };

      const result = await controller.updateStatus(
        mockUser,
        mockPaymentId,
        dto,
      );

      expect(result.receiptUrl).toBe('https://example.com/receipt.pdf');
    });

    it('should handle provider updating payment status', async () => {
      const providerPayment = {
        ...mockPayment,
        userId: mockProviderId,
        status: PaymentStatus.COMPLETED,
      };
      paymentsService.updatePaymentStatus.mockResolvedValue(
        providerPayment as unknown as PaymentEntity,
      );

      const dto: UpdatePaymentStatusDto = {
        status: PaymentStatus.COMPLETED,
      };

      await controller.updateStatus(mockProvider, mockPaymentId, dto);

      expect(paymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockProviderId,
        mockPaymentId,
        dto,
      );
    });
  });
});

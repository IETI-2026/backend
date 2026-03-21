import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentEntity,
  ServiceRequestEntity,
  UserEntity,
  UserPaymentMethodEntity,
} from '@/database/entities';
import { PaymentMethodType, PaymentStatus, RoleName } from '@/database/enums';
import {
  CreatePaymentDto,
  CreatePaymentMethodDto,
  UpdatePaymentStatusDto,
} from './dtos';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(UserPaymentMethodEntity)
    private readonly paymentMethodRepository: Repository<UserPaymentMethodEntity>,
    @InjectRepository(ServiceRequestEntity)
    private readonly serviceRequestRepository: Repository<ServiceRequestEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async getAvailableMethodsForUser(
    userId: string,
  ): Promise<PaymentMethodType[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const baseMethods = [
      PaymentMethodType.EPAYCO,
      PaymentMethodType.NEQUI,
      PaymentMethodType.DAVIPLATA,
      PaymentMethodType.CASH,
    ];

    if (user.primaryRole === RoleName.PROVIDER) {
      return [...baseMethods, PaymentMethodType.BANK_TRANSFER];
    }

    return baseMethods;
  }

  async getMyPaymentMethods(
    userId: string,
  ): Promise<UserPaymentMethodEntity[]> {
    return this.paymentMethodRepository.find({
      where: { userId, isActive: true },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async createPaymentMethod(
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<UserPaymentMethodEntity> {
    this.logger.log(
      `Creating payment method type=${dto.methodType} for user=${userId}`,
    );

    const availableMethods = await this.getAvailableMethodsForUser(userId);

    if (!availableMethods.includes(dto.methodType)) {
      this.logger.warn(
        `Payment method ${dto.methodType} not allowed for user=${userId}`,
      );
      throw new BadRequestException(
        `Método ${dto.methodType} no habilitado para este usuario`,
      );
    }

    const needsIdentifier = dto.methodType !== PaymentMethodType.CASH;
    if (needsIdentifier && !dto.accountIdentifier?.trim()) {
      throw new BadRequestException(
        'accountIdentifier es requerido para este método de pago',
      );
    }

    if (dto.isDefault) {
      await this.paymentMethodRepository.update(
        { userId, isActive: true },
        { isDefault: false },
      );
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const defaultRole =
      user.primaryRole === RoleName.PROVIDER
        ? RoleName.PROVIDER
        : RoleName.USER;

    const paymentMethod = this.paymentMethodRepository.create({
      userId,
      forRole: dto.forRole ?? defaultRole,
      methodType: dto.methodType,
      alias: dto.alias?.trim() || null,
      accountHolder: dto.accountHolder?.trim() || null,
      accountIdentifier: dto.accountIdentifier?.trim() || null,
      details: dto.details ?? null,
      isDefault: dto.isDefault ?? false,
      isActive: true,
    });

    const saved = await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(
      `Payment method created id=${saved.id} type=${saved.methodType} user=${userId}`,
    );
    return saved;
  }

  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<UserPaymentMethodEntity> {
    this.logger.log(
      `Setting default payment method id=${paymentMethodId} for user=${userId}`,
    );

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, userId, isActive: true },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    await this.paymentMethodRepository.update(
      { userId, isActive: true },
      { isDefault: false },
    );

    paymentMethod.isDefault = true;
    const saved = await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(
      `Default payment method updated to id=${paymentMethodId} for user=${userId}`,
    );
    return saved;
  }

  async disablePaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    this.logger.log(
      `Disabling payment method id=${paymentMethodId} for user=${userId}`,
    );

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, userId, isActive: true },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    paymentMethod.isActive = false;
    paymentMethod.isDefault = false;
    await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(
      `Payment method disabled id=${paymentMethodId} for user=${userId}`,
    );
  }

  async getMyPayments(userId: string): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `Creating payment for serviceRequest=${dto.serviceRequestId} user=${userId} grossAmount=${dto.grossAmount}`,
    );

    const serviceRequest = await this.serviceRequestRepository.findOne({
      where: { id: dto.serviceRequestId },
      select: ['id', 'userId'],
    });

    if (!serviceRequest) {
      throw new NotFoundException('Solicitud de servicio no encontrada');
    }

    if (serviceRequest.userId !== userId) {
      throw new ForbiddenException(
        'No puedes registrar pagos para esta solicitud',
      );
    }

    const existingPayment = await this.paymentRepository.findOne({
      where: { serviceRequestId: dto.serviceRequestId },
      select: ['id'],
    });

    if (existingPayment) {
      throw new BadRequestException('La solicitud ya tiene un pago asociado');
    }

    let selectedMethod = dto.paymentMethod;

    if (dto.paymentMethodId) {
      const storedMethod = await this.paymentMethodRepository.findOne({
        where: { id: dto.paymentMethodId, userId, isActive: true },
      });

      if (!storedMethod) {
        throw new NotFoundException('Método de pago guardado no encontrado');
      }

      selectedMethod = storedMethod.methodType;
    }

    if (!selectedMethod) {
      throw new BadRequestException(
        'Debes enviar paymentMethod o paymentMethodId',
      );
    }

    const availableMethods = await this.getAvailableMethodsForUser(userId);
    if (!availableMethods.includes(selectedMethod)) {
      throw new BadRequestException(
        `Método ${selectedMethod} no habilitado para este usuario`,
      );
    }

    const commissionRate = dto.commissionRate ?? 0;
    const grossAmount = Number(dto.grossAmount.toFixed(2));
    const commissionAmount = Number((grossAmount * commissionRate).toFixed(2));
    const netAmount = Number((grossAmount - commissionAmount).toFixed(2));

    if (netAmount < 0) {
      throw new BadRequestException('El neto no puede ser negativo');
    }

    const payment = this.paymentRepository.create({
      serviceRequestId: dto.serviceRequestId,
      userId,
      grossAmount: grossAmount.toFixed(2),
      commissionRate,
      commissionAmount: commissionAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      paymentMethod: selectedMethod,
      status:
        selectedMethod === PaymentMethodType.CASH
          ? PaymentStatus.PENDING
          : PaymentStatus.PROCESSING,
      externalTransactionId: dto.externalTransactionId?.trim() || null,
      gatewayReference: dto.gatewayReference?.trim() || null,
      gatewayResponse: dto.gatewayResponse ?? null,
      paidAt: null,
      refundedAt: null,
      refundReason: null,
      receiptUrl: null,
    });

    const savedPayment = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment created id=${savedPayment.id} method=${savedPayment.paymentMethod} status=${savedPayment.status} net=${savedPayment.netAmount}`,
    );
    return savedPayment;
  }

  async updatePaymentStatus(
    userId: string,
    paymentId: string,
    dto: UpdatePaymentStatusDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `Updating payment status id=${paymentId} newStatus=${dto.status} user=${userId}`,
    );

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('No puedes modificar este pago');
    }

    payment.status = dto.status;

    if (dto.status === PaymentStatus.COMPLETED) {
      payment.paidAt = new Date();
      payment.refundReason = null;
      payment.refundedAt = null;
    }

    if (dto.status === PaymentStatus.REFUNDED) {
      payment.refundedAt = new Date();
      payment.refundReason = dto.reason?.trim() || 'Refund manual';
    }

    if (dto.status === PaymentStatus.FAILED && dto.reason) {
      payment.refundReason = dto.reason.trim();
    }

    if (dto.receiptUrl?.trim()) {
      payment.receiptUrl = dto.receiptUrl.trim();
    }

    const updated = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment status updated id=${paymentId} status=${payment.status}`,
    );
    return updated;
  }
}

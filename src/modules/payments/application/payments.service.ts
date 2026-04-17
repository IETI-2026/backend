import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { ServiceRequestsGateway } from '../../service-requests/presentation/gateways/service-requests.gateway';
import {
  CreatePaymentDto,
  CreatePaymentMethodDto,
  EpaycoWebhookDto,
  UpdatePaymentStatusDto,
} from './dtos';

/** Comisión de plataforma por defecto (5 %). */
const DEFAULT_COMMISSION_RATE = 0.05;

/**
 * Mapa de transiciones de estado permitidas.
 * Solo las enumeradas aquí son válidas; cualquier otra lanza 422.
 */
const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.PROCESSING]: [
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.CANCELLED]: [],
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly epaycoCustomerId: string;
  private readonly epaycoPrivateKey: string;

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(UserPaymentMethodEntity)
    private readonly paymentMethodRepository: Repository<UserPaymentMethodEntity>,
    @InjectRepository(ServiceRequestEntity)
    private readonly serviceRequestRepository: Repository<ServiceRequestEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly gateway: ServiceRequestsGateway,
  ) {
    const customerId = process.env.EPAYCO_P_CUST_ID;
    const privateKey = process.env.EPAYCO_P_KEY;
    if (!customerId) {
      throw new Error('EPAYCO_P_CUST_ID environment variable is not defined');
    }
    if (!privateKey) {
      throw new Error('EPAYCO_P_KEY environment variable is not defined');
    }
    this.epaycoCustomerId = customerId;
    this.epaycoPrivateKey = privateKey;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payment Methods
  // ─────────────────────────────────────────────────────────────────────────

  async getAvailableMethodsForUser(
    userId: string,
  ): Promise<PaymentMethodType[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const baseMethods: PaymentMethodType[] = [
      PaymentMethodType.EPAYCO,
      PaymentMethodType.NEQUI,
      PaymentMethodType.DAVIPLATA,
      PaymentMethodType.CASH,
    ];

    return user.primaryRole === RoleName.PROVIDER
      ? [...baseMethods, PaymentMethodType.BANK_TRANSFER]
      : baseMethods;
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
    if (!user) throw new NotFoundException('Usuario no encontrado');

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
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, userId, isActive: true },
    });
    if (!paymentMethod)
      throw new NotFoundException('Método de pago no encontrado');

    await this.paymentMethodRepository.update(
      { userId, isActive: true },
      { isDefault: false },
    );

    paymentMethod.isDefault = true;
    const saved = await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(
      `Default payment method set to id=${paymentMethodId} for user=${userId}`,
    );
    return saved;
  }

  async disablePaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, userId, isActive: true },
    });
    if (!paymentMethod)
      throw new NotFoundException('Método de pago no encontrado');

    paymentMethod.isActive = false;
    paymentMethod.isDefault = false;
    await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(
      `Payment method disabled id=${paymentMethodId} for user=${userId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payments — Queries
  // ─────────────────────────────────────────────────────────────────────────

  async getMyPayments(userId: string): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: { userId },
      relations: ['serviceRequest'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Devuelve el pago asociado a una solicitud de servicio, o null si no existe.
   * Sólo el cliente propietario o el técnico asignado pueden consultarlo.
   */
  async getPaymentByServiceRequest(
    serviceRequestId: string,
    userId: string,
  ): Promise<PaymentEntity | null> {
    const serviceRequest = await this.serviceRequestRepository.findOne({
      where: { id: serviceRequestId },
      select: ['id', 'userId', 'assignedTechnicianId'],
    });

    if (!serviceRequest)
      throw new NotFoundException('Solicitud de servicio no encontrada');

    const isOwner = serviceRequest.userId === userId;
    const isTechnician = serviceRequest.assignedTechnicianId === userId;

    if (!isOwner && !isTechnician) {
      throw new ForbiddenException(
        'No tienes acceso al pago de esta solicitud',
      );
    }

    return this.paymentRepository.findOne({
      where: { serviceRequestId },
      relations: ['serviceRequest'],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payments — Commands
  // ─────────────────────────────────────────────────────────────────────────

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `Creating payment serviceRequest=${dto.serviceRequestId} user=${userId} amount=${dto.grossAmount}`,
    );

    const serviceRequest = await this.serviceRequestRepository.findOne({
      where: { id: dto.serviceRequestId },
    });

    if (!serviceRequest)
      throw new NotFoundException('Solicitud de servicio no encontrada');

    if (serviceRequest.userId !== userId) {
      throw new ForbiddenException(
        'No puedes registrar pagos para esta solicitud',
      );
    }

    // El servicio debe estar COMPLETADO para poder pagar
    if (serviceRequest.status !== ServiceRequestStatus.COMPLETED) {
      throw new UnprocessableEntityException(
        `El servicio debe estar COMPLETADO antes de procesar el pago. Estado actual: ${serviceRequest.status}`,
      );
    }

    const existingPayment = await this.paymentRepository.findOne({
      where: { serviceRequestId: dto.serviceRequestId },
      select: ['id', 'status'],
    });

    if (existingPayment) {
      // Si ya está COMPLETADO devolvemos el existente (idempotente)
      if (existingPayment.status === PaymentStatus.COMPLETED) {
        this.logger.log(
          `Payment already completed for serviceRequest=${dto.serviceRequestId}, returning existing`,
        );
        return this.paymentRepository.findOneOrFail({
          where: { id: existingPayment.id },
          relations: ['serviceRequest'],
        });
      }
      throw new ConflictException(
        'La solicitud ya tiene un pago registrado. Actualiza su estado en lugar de crear uno nuevo.',
      );
    }

    // Resolver método de pago
    let selectedMethod = dto.paymentMethod;

    if (dto.paymentMethodId) {
      const storedMethod = await this.paymentMethodRepository.findOne({
        where: { id: dto.paymentMethodId, userId, isActive: true },
      });
      if (!storedMethod)
        throw new NotFoundException('Método de pago guardado no encontrado');
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

    // Usar finalPrice de la solicitud si no se envía grossAmount o es 0
    const grossAmount =
      dto.grossAmount > 0
        ? Number(dto.grossAmount.toFixed(2))
        : serviceRequest.finalPrice
          ? Number(parseFloat(serviceRequest.finalPrice).toFixed(2))
          : 0;

    if (grossAmount <= 0) {
      throw new UnprocessableEntityException(
        'El monto del pago debe ser mayor a 0',
      );
    }

    const commissionRate = dto.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const commissionAmount = Number((grossAmount * commissionRate).toFixed(2));
    const netAmount = Number((grossAmount - commissionAmount).toFixed(2));

    // Generar referencia de gateway automáticamente si no se proporciona
    const gatewayReference =
      dto.gatewayReference?.trim() ||
      `EP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const initialStatus =
      selectedMethod === PaymentMethodType.CASH
        ? PaymentStatus.PENDING
        : PaymentStatus.PROCESSING;

    const payment = this.paymentRepository.create({
      serviceRequestId: dto.serviceRequestId,
      userId,
      grossAmount: grossAmount.toFixed(2),
      commissionRate,
      commissionAmount: commissionAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      paymentMethod: selectedMethod,
      status: initialStatus,
      externalTransactionId: dto.externalTransactionId?.trim() || null,
      gatewayReference,
      gatewayResponse: dto.gatewayResponse ?? null,
      paidAt: null,
      refundedAt: null,
      refundReason: null,
      receiptUrl: null,
    });

    const saved = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment created id=${saved.id} method=${saved.paymentMethod} status=${saved.status} net=${saved.netAmount} ref=${saved.gatewayReference}`,
    );
    return saved;
  }

  async updatePaymentStatus(
    userId: string,
    paymentId: string,
    dto: UpdatePaymentStatusDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `Updating payment id=${paymentId} → ${dto.status} by user=${userId}`,
    );

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) throw new NotFoundException('Pago no encontrado');

    if (payment.userId !== userId) {
      throw new ForbiddenException('No puedes modificar este pago');
    }

    // Validar transición de estado
    const allowed = ALLOWED_TRANSITIONS[payment.status] ?? [];
    if (!(allowed as PaymentStatus[]).includes(dto.status)) {
      throw new UnprocessableEntityException(
        `Transición inválida: ${payment.status} → ${dto.status}. ` +
          `Transiciones permitidas desde ${payment.status}: [${(allowed as PaymentStatus[]).join(', ') || 'ninguna'}]`,
      );
    }

    const previousStatus = payment.status;
    payment.status = dto.status;

    if (dto.status === PaymentStatus.COMPLETED) {
      payment.paidAt = new Date();
      payment.refundReason = null;
      payment.refundedAt = null;
      if (dto.receiptUrl?.trim()) {
        payment.receiptUrl = dto.receiptUrl.trim();
      } else {
        // Generar URL de recibo simulada si no se proporciona
        payment.receiptUrl = `https://secure.epayco.co/recibos/${payment.gatewayReference ?? payment.id}`;
      }
    }

    if (dto.status === PaymentStatus.REFUNDED) {
      payment.refundedAt = new Date();
      payment.refundReason = dto.reason?.trim() || 'Reembolso solicitado';
    }

    if (
      (dto.status === PaymentStatus.FAILED ||
        dto.status === PaymentStatus.CANCELLED) &&
      dto.reason
    ) {
      payment.refundReason = dto.reason.trim();
    }

    const updated = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment ${paymentId} status: ${previousStatus} → ${payment.status}`,
    );

    // Emitir evento WebSocket al completar o fallar
    if (
      dto.status === PaymentStatus.COMPLETED ||
      dto.status === PaymentStatus.FAILED ||
      dto.status === PaymentStatus.CANCELLED
    ) {
      this.gateway.emitPaymentCompleted(payment.serviceRequestId, {
        paymentId: payment.id,
        amount: parseFloat(payment.grossAmount),
        method: payment.paymentMethod,
        status: payment.status,
        paidAt: payment.paidAt ?? new Date(),
      });
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ePayco Webhook
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Procesa el webhook de confirmación que envía ePayco.
   * Busca el pago por x_extra1 (paymentId interno) o por gatewayReference.
   * Actualiza el estado y emite evento WebSocket.
   *
   * Retorna siempre { received: true } para que ePayco no reintente.
   */
  async processEpaycoWebhook(
    data: EpaycoWebhookDto,
  ): Promise<{ received: boolean }> {
    if (!this.verifyEpaycoSignature(data)) {
      this.logger.warn(
        `ePayco webhook: invalid signature ref=${data.x_ref_payco}`,
      );
      throw new UnauthorizedException('Invalid signature');
    }

    const { x_ref_payco, x_extra1, x_response } = data;
    this.logger.log(
      `ePayco webhook received ref=${x_ref_payco} response=${x_response}`,
    );

    // Buscar pago por ID interno (x_extra1) o por referencia del gateway
    let payment: PaymentEntity | null = null;

    if (x_extra1) {
      payment = await this.paymentRepository.findOne({
        where: { id: x_extra1 },
      });
    }

    if (!payment) {
      payment = await this.paymentRepository.findOne({
        where: { gatewayReference: x_ref_payco },
      });
    }

    if (!payment) {
      this.logger.warn(
        `ePayco webhook: no payment found ref=${x_ref_payco} extra1=${x_extra1 ?? 'N/A'}`,
      );
      return { received: true };
    }

    const newStatus = this.mapEpaycoResponse(x_response);
    const allowed = ALLOWED_TRANSITIONS[payment.status] ?? [];

    if (!(allowed as PaymentStatus[]).includes(newStatus)) {
      this.logger.warn(
        `ePayco webhook: invalid transition ${payment.status} → ${newStatus}, ignoring`,
      );
      return { received: true };
    }

    const previousStatus = payment.status;
    payment.status = newStatus;
    payment.gatewayResponse = data as unknown as Record<string, unknown>;

    if (newStatus === PaymentStatus.COMPLETED) {
      payment.paidAt = new Date();
      payment.receiptUrl = `https://secure.epayco.co/recibos/${x_ref_payco}`;
    }

    if (
      newStatus === PaymentStatus.REFUNDED ||
      data.x_transaction_state === 'Reversada'
    ) {
      payment.refundedAt = new Date();
      payment.refundReason = 'Reversada por ePayco';
    }

    await this.paymentRepository.save(payment);
    this.logger.log(
      `ePayco webhook: payment ${payment.id} ${previousStatus} → ${newStatus}`,
    );

    // Notificar vía WebSocket
    this.gateway.emitPaymentCompleted(payment.serviceRequestId, {
      paymentId: payment.id,
      amount: parseFloat(payment.grossAmount),
      method: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt ?? new Date(),
    });

    return { received: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private verifyEpaycoSignature(data: EpaycoWebhookDto): boolean {
    if (!data.x_signature) {
      return false;
    }

    const signatureString = [
      this.epaycoCustomerId,
      this.epaycoPrivateKey,
      data.x_ref_payco,
      data.x_transaction_id ?? '',
      data.x_amount ?? '',
      data.x_currency_code ?? '',
      data.x_franchise ?? '',
      data.x_response,
    ].join('^');

    const expected = createHash('sha256').update(signatureString).digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(data.x_signature.toLowerCase()),
      );
    } catch {
      return false;
    }
  }

  private mapEpaycoResponse(xResponse: string): PaymentStatus {
    switch (xResponse) {
      case '1':
        return PaymentStatus.COMPLETED; // Aceptada
      case '2':
        return PaymentStatus.FAILED; // Rechazada
      case '3':
        return PaymentStatus.PENDING; // Pendiente
      case '4':
        return PaymentStatus.FAILED; // Fallida
      case '6':
        return PaymentStatus.REFUNDED; // Reversada
      default:
        return PaymentStatus.FAILED;
    }
  }
}

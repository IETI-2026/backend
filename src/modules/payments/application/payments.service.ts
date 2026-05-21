import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
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
import { MailService } from '../../mail/application/mail.service';
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

  private get paymentRepo(): Repository<PaymentEntity> {
    return this.tenantDs.getRepository(PaymentEntity);
  }

  private get paymentMethodRepo(): Repository<UserPaymentMethodEntity> {
    return this.tenantDs.getRepository(UserPaymentMethodEntity);
  }

  private get serviceRequestRepo(): Repository<ServiceRequestEntity> {
    return this.tenantDs.getRepository(ServiceRequestEntity);
  }

  constructor(
    @Inject(TENANT_DATA_SOURCE)
    private readonly tenantDs: DataSource,
    private readonly tenantDataSourceService: TenantDataSourceService,
    private readonly gateway: ServiceRequestsGateway,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    const customerId = this.configService.get<string>('epayco.customerId');
    const privateKey = this.configService.get<string>('epayco.privateKey');
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
    const user = await this.getPublicUserRepo().then((r) =>
      r.findOne({ where: { id: userId } }),
    );
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
    return this.paymentMethodRepo.find({
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
      await this.paymentMethodRepo.update(
        { userId, isActive: true },
        { isDefault: false },
      );
    }

    const user = await this.getPublicUserRepo().then((r) =>
      r.findOne({ where: { id: userId } }),
    );
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const defaultRole =
      user.primaryRole === RoleName.PROVIDER
        ? RoleName.PROVIDER
        : RoleName.USER;

    const paymentMethod = this.paymentMethodRepo.create({
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

    const saved = await this.paymentMethodRepo.save(paymentMethod);
    this.logger.log(
      `Payment method created id=${saved.id} type=${saved.methodType} user=${userId}`,
    );
    return saved;
  }

  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<UserPaymentMethodEntity> {
    const paymentMethod = await this.paymentMethodRepo.findOne({
      where: { id: paymentMethodId, userId, isActive: true },
    });
    if (!paymentMethod)
      throw new NotFoundException('Método de pago no encontrado');

    await this.paymentMethodRepo.update(
      { userId, isActive: true },
      { isDefault: false },
    );

    paymentMethod.isDefault = true;
    const saved = await this.paymentMethodRepo.save(paymentMethod);
    this.logger.log(
      `Default payment method set to id=${paymentMethodId} for user=${userId}`,
    );
    return saved;
  }

  async disablePaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodRepo.findOne({
      where: { id: paymentMethodId, userId, isActive: true },
    });
    if (!paymentMethod)
      throw new NotFoundException('Método de pago no encontrado');

    paymentMethod.isActive = false;
    paymentMethod.isDefault = false;
    await this.paymentMethodRepo.save(paymentMethod);
    this.logger.log(
      `Payment method disabled id=${paymentMethodId} for user=${userId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payments — Queries
  // ─────────────────────────────────────────────────────────────────────────

  async getMyPayments(userId: string): Promise<PaymentEntity[]> {
    return this.paymentRepo.find({
      where: { userId },
      relations: ['serviceRequest'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPaymentByServiceRequest(
    serviceRequestId: string,
    userId: string,
  ): Promise<PaymentEntity> {
    const serviceRequest = await this.serviceRequestRepo.findOne({
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

    const payment = await this.paymentRepo.findOne({
      where: { serviceRequestId },
      relations: ['serviceRequest'],
    });

    if (!payment)
      throw new NotFoundException(
        'No se encontró un pago para esta solicitud de servicio',
      );

    return payment;
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

    const serviceRequest = await this.serviceRequestRepo.findOne({
      where: { id: dto.serviceRequestId },
    });

    if (!serviceRequest)
      throw new NotFoundException('Solicitud de servicio no encontrada');

    if (serviceRequest.userId !== userId) {
      throw new ForbiddenException(
        'No puedes registrar pagos para esta solicitud',
      );
    }

    if (serviceRequest.status !== ServiceRequestStatus.COMPLETED) {
      throw new UnprocessableEntityException(
        `El servicio debe estar COMPLETADO antes de procesar el pago. Estado actual: ${serviceRequest.status}`,
      );
    }

    const existingPayment = await this.paymentRepo.findOne({
      where: { serviceRequestId: dto.serviceRequestId },
      select: ['id', 'status'],
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.COMPLETED) {
        this.logger.log(
          `Payment already completed for serviceRequest=${dto.serviceRequestId}, returning existing`,
        );
        return this.paymentRepo.findOneOrFail({
          where: { id: existingPayment.id },
          relations: ['serviceRequest'],
        });
      }
      throw new ConflictException(
        'La solicitud ya tiene un pago registrado. Actualiza su estado en lugar de crear uno nuevo.',
      );
    }

    let selectedMethod = dto.paymentMethod;

    if (dto.paymentMethodId) {
      const storedMethod = await this.paymentMethodRepo.findOne({
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

    const gatewayReference =
      dto.gatewayReference?.trim() ||
      `EP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const initialStatus =
      selectedMethod === PaymentMethodType.CASH
        ? PaymentStatus.PENDING
        : PaymentStatus.PROCESSING;

    const payment = this.paymentRepo.create({
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

    const saved = await this.paymentRepo.save(payment);
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

    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });

    if (!payment) throw new NotFoundException('Pago no encontrado');

    if (payment.userId !== userId) {
      throw new ForbiddenException('No puedes modificar este pago');
    }

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
      payment.receiptUrl = dto.receiptUrl?.trim()
        ? dto.receiptUrl.trim()
        : `https://secure.epayco.co/recibos/${payment.gatewayReference ?? payment.id}`;
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

    const updated = await this.paymentRepo.save(payment);
    this.logger.log(
      `Payment ${paymentId} status: ${previousStatus} → ${payment.status}`,
    );

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

    if (dto.status === PaymentStatus.COMPLETED) {
      void this.sendPaymentEmail(payment);
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ePayco Webhook
  // ─────────────────────────────────────────────────────────────────────────

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

    let payment: PaymentEntity | null = null;

    if (x_extra1) {
      payment = await this.paymentRepo.findOne({ where: { id: x_extra1 } });
    }

    if (!payment) {
      payment = await this.paymentRepo.findOne({
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

    await this.paymentRepo.save(payment);
    this.logger.log(
      `ePayco webhook: payment ${payment.id} ${previousStatus} → ${newStatus}`,
    );

    this.gateway.emitPaymentCompleted(payment.serviceRequestId, {
      paymentId: payment.id,
      amount: parseFloat(payment.grossAmount),
      method: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt ?? new Date(),
    });

    if (newStatus === PaymentStatus.COMPLETED) {
      void this.sendPaymentEmail(payment);
    }

    return { received: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ePayco Checkout HTML
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera el HTML de la página de checkout de ePayco para un pago.
   * La URL de confirmación apunta al webhook del backend.
   */
  async getEpaycoCheckoutHtml(
    paymentId: string,
    userId: string,
    backendUrl: string,
  ): Promise<string> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['serviceRequest'],
    });

    if (!payment) throw new NotFoundException('Pago no encontrado');

    if (payment.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este pago');
    }

    if (payment.paymentMethod !== PaymentMethodType.EPAYCO) {
      throw new BadRequestException(
        'El checkout de ePayco solo aplica para pagos con método EPAYCO',
      );
    }

    if (payment.status !== PaymentStatus.PROCESSING) {
      throw new UnprocessableEntityException(
        `Solo se puede iniciar el checkout para pagos en estado PROCESSING. Estado actual: ${payment.status}`,
      );
    }

    const confirmationUrl = `${backendUrl}/payments/epayco/webhook`;
    const responseUrl = `${backendUrl}/payments/epayco/response`;
    const amount = parseFloat(payment.grossAmount).toFixed(2);
    const description = payment.serviceRequest
      ? `Servicio #${payment.serviceRequest.id.substring(0, 8)}`
      : `Pago #${payment.id.substring(0, 8)}`;

    return this.buildEpaycoCheckoutHtml({
      custId: this.epaycoCustomerId,
      pKey: this.epaycoPrivateKey,
      amount,
      description,
      paymentId: payment.id,
      serviceRequestId: payment.serviceRequestId,
      gatewayReference: payment.gatewayReference ?? payment.id,
      confirmationUrl,
      responseUrl,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async getPublicUserRepo() {
    const publicDs = await this.tenantDataSourceService.getDataSource('public');
    return publicDs.getRepository(UserEntity);
  }

  private async sendPaymentEmail(payment: PaymentEntity): Promise<void> {
    try {
      const user = await this.getPublicUserRepo().then((r) =>
        r.findOne({
          where: { id: payment.userId },
          select: ['email', 'fullName'],
        }),
      );
      if (!user?.email) return;

      const paidAt = payment.paidAt ?? new Date();
      await this.mailService.sendPaymentConfirmationEmail(
        user.email,
        user.fullName ?? 'Usuario',
        {
          amount: new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
          }).format(parseFloat(payment.grossAmount)),
          paymentMethod: payment.paymentMethod,
          transactionId:
            payment.externalTransactionId ??
            payment.gatewayReference ??
            payment.id,
          paymentDate: paidAt.toISOString().split('T')[0],
          paymentTime: paidAt.toTimeString().substring(0, 5),
        },
        'https://app.cameyo.co/dashboard',
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send payment confirmation email: ${String(err)}`,
      );
    }
  }

  private buildEpaycoCheckoutHtml(params: {
    custId: string;
    pKey: string;
    amount: string;
    description: string;
    paymentId: string;
    serviceRequestId: string;
    gatewayReference: string;
    confirmationUrl: string;
    responseUrl: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pago CameYo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; margin-bottom: 24px; }
    .amount { font-size: 28px; font-weight: 700; color: #2563eb; margin: 16px 0; }
    .epayco-button {
      display: inline-block;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }
    .spinner {
      display: none;
      margin: 20px auto;
      width: 32px; height: 32px;
      border: 3px solid #e5e7eb;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h1>CameYo — Pago de servicio</h1>
    <p>${params.description}</p>
    <div class="amount">COP $${params.amount}</div>
    <div class="spinner" id="spinner"></div>
    <form id="epayco-form">
      <script
        src="https://checkout.epayco.co/checkout.js"
        data-p_cust_id_cliente="${params.custId}"
        data-p_key="${params.pKey}"
        data-name="CameYo — Servicio técnico"
        data-description="${params.description}"
        data-amount="${params.amount}"
        data-currency="COP"
        data-country="CO"
        data-lang="ES"
        data-test="false"
        data-external="false"
        data-extra1="${params.paymentId}"
        data-extra2="${params.serviceRequestId}"
        data-id-invoice="${params.gatewayReference}"
        data-url_confirmation="${params.confirmationUrl}"
        data-url_response="${params.responseUrl}"
        class="epayco-button"
      ></script>
    </form>
    <p style="margin-top:16px;font-size:12px;color:#999">
      Pago seguro procesado por ePayco
    </p>
  </div>
  <script>
    document.querySelector('.epayco-button')?.addEventListener('click', function() {
      document.getElementById('spinner').style.display = 'block';
    });
  </script>
</body>
</html>`;
  }

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
        return PaymentStatus.COMPLETED;
      case '2':
        return PaymentStatus.FAILED;
      case '3':
        return PaymentStatus.PENDING;
      case '4':
        return PaymentStatus.FAILED;
      case '6':
        return PaymentStatus.REFUNDED;
      default:
        return PaymentStatus.FAILED;
    }
  }
}

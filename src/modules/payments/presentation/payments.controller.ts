import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentEntity, UserPaymentMethodEntity } from '@/database/entities';
import { RoleName } from '@/database/enums';
import { JwtPayloadEntity } from '../../auth/domain/entities';
import { CurrentUser } from '../../auth/infrastructure/decorators';
import { Public } from '../../auth/infrastructure/decorators/public.decorator';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import {
  CreatePaymentDto,
  CreatePaymentMethodDto,
  EpaycoWebhookDto,
  PaymentsService,
  UpdatePaymentStatusDto,
} from '../application';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  private getUserId(user: JwtPayloadEntity): string {
    if (!user.sub) {
      throw new ForbiddenException(
        'No se pudo resolver el usuario autenticado',
      );
    }
    return user.sub;
  }

  // ──────────────────────────── Payment Methods ────────────────────────────

  @Get('methods/available')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Listar métodos de pago disponibles para el usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Métodos de pago disponibles según el rol del usuario',
    type: String,
    isArray: true,
  })
  async getAvailableMethods(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<string[]> {
    this.logger.log(`GET /payments/methods/available - user=${user.sub}`);
    return this.paymentsService.getAvailableMethodsForUser(
      this.getUserId(user),
    );
  }

  @Get('methods/mine')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Obtener métodos de pago guardados por el usuario autenticado',
  })
  @ApiOkResponse({ type: UserPaymentMethodEntity, isArray: true })
  async getMyMethods(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<UserPaymentMethodEntity[]> {
    this.logger.log(`GET /payments/methods/mine - user=${user.sub}`);
    return this.paymentsService.getMyPaymentMethods(this.getUserId(user));
  }

  @Post('methods')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo método de pago para el usuario',
  })
  @ApiCreatedResponse({ type: UserPaymentMethodEntity })
  async createMethod(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: CreatePaymentMethodDto,
  ): Promise<UserPaymentMethodEntity> {
    this.logger.log(
      `POST /payments/methods - user=${user.sub} type=${dto.methodType}`,
    );
    return this.paymentsService.createPaymentMethod(this.getUserId(user), dto);
  }

  @Patch('methods/:paymentMethodId/default')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Marcar un método de pago guardado como predeterminado',
  })
  @ApiOkResponse({ type: UserPaymentMethodEntity })
  @ApiNotFoundResponse({ description: 'Método de pago no encontrado' })
  @ApiParam({ name: 'paymentMethodId', format: 'uuid' })
  async setDefaultMethod(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentMethodId', ParseUUIDPipe) paymentMethodId: string,
  ): Promise<UserPaymentMethodEntity> {
    this.logger.log(
      `PATCH /payments/methods/${paymentMethodId}/default - user=${user.sub}`,
    );
    return this.paymentsService.setDefaultPaymentMethod(
      this.getUserId(user),
      paymentMethodId,
    );
  }

  @Delete('methods/:paymentMethodId')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar un método de pago guardado' })
  @ApiNoContentResponse({ description: 'Método desactivado correctamente' })
  @ApiNotFoundResponse({ description: 'Método de pago no encontrado' })
  @ApiParam({ name: 'paymentMethodId', format: 'uuid' })
  async deleteMethod(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentMethodId', ParseUUIDPipe) paymentMethodId: string,
  ): Promise<void> {
    this.logger.log(
      `DELETE /payments/methods/${paymentMethodId} - user=${user.sub}`,
    );
    await this.paymentsService.disablePaymentMethod(
      this.getUserId(user),
      paymentMethodId,
    );
  }

  // ──────────────────────────── Payments ────────────────────────────

  @Get('mine')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary:
      'Listar pagos del usuario autenticado (incluye datos de la solicitud de servicio)',
  })
  @ApiOkResponse({ type: PaymentEntity, isArray: true })
  async getMyPayments(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<PaymentEntity[]> {
    this.logger.log(`GET /payments/mine - user=${user.sub}`);
    return this.paymentsService.getMyPayments(this.getUserId(user));
  }

  /**
   * Retorna el pago asociado a una solicitud de servicio.
   * Accesible por el cliente propietario o el técnico asignado.
   * Retorna 404 si la solicitud no tiene pago aún.
   */
  @Get('service-request/:serviceRequestId')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary:
      'Obtener el pago de una solicitud de servicio específica (si existe)',
    description:
      'Accesible por el cliente propietario o el técnico asignado. ' +
      'Retorna 404 si la solicitud no tiene pago registrado todavía.',
  })
  @ApiOkResponse({
    type: PaymentEntity,
    description: 'Pago encontrado para la solicitud',
  })
  @ApiNotFoundResponse({
    description: 'Solicitud no encontrada o sin pago asociado',
  })
  @ApiParam({ name: 'serviceRequestId', format: 'uuid' })
  async getPaymentByServiceRequest(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('serviceRequestId', ParseUUIDPipe) serviceRequestId: string,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `GET /payments/service-request/${serviceRequestId} - user=${user.sub}`,
    );
    return this.paymentsService.getPaymentByServiceRequest(
      serviceRequestId,
      this.getUserId(user),
    );
  }

  @Post()
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear registro de pago para una solicitud de servicio completada',
    description:
      'El servicio debe estar en estado COMPLETED. ' +
      'Si ya existe un pago COMPLETED, lo devuelve de forma idempotente.',
  })
  @ApiCreatedResponse({ type: PaymentEntity })
  @ApiNotFoundResponse({ description: 'Solicitud de servicio no encontrada' })
  @ApiConflictResponse({
    description: 'La solicitud ya tiene un pago en proceso',
  })
  @ApiUnprocessableEntityResponse({
    description: 'El servicio no está en estado COMPLETED o el monto es 0',
  })
  async createPayment(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `POST /payments - user=${user.sub} serviceRequest=${dto.serviceRequestId}`,
    );
    return this.paymentsService.createPayment(this.getUserId(user), dto);
  }

  @Patch(':paymentId/status')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Actualizar el estado transaccional de un pago',
    description:
      'Solo el propietario del pago puede actualizarlo. ' +
      'Las transiciones inválidas retornan 422. ' +
      'Al completar se emite el evento WebSocket payment_completed.',
  })
  @ApiOkResponse({ type: PaymentEntity })
  @ApiNotFoundResponse({ description: 'Pago no encontrado' })
  @ApiUnprocessableEntityResponse({
    description: 'Transición de estado inválida',
  })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  async updateStatus(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdatePaymentStatusDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `PATCH /payments/${paymentId}/status → ${dto.status} - user=${user.sub}`,
    );
    return this.paymentsService.updatePaymentStatus(
      this.getUserId(user),
      paymentId,
      dto,
    );
  }

  // ──────────────────────────── ePayco Checkout ────────────────────────────

  /**
   * Retorna una página HTML con el formulario de checkout de ePayco.
   * El cliente abre esta URL en un navegador o WebView para completar el pago.
   */
  @Get(':paymentId/epayco-checkout')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Obtener página de checkout ePayco para un pago',
    description:
      'Devuelve HTML con el formulario de ePayco listo para abrir en navegador/WebView. ' +
      'Solo aplica para pagos con método EPAYCO en estado PROCESSING.',
  })
  @ApiOkResponse({ description: 'HTML de checkout de ePayco' })
  @ApiNotFoundResponse({ description: 'Pago no encontrado' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  async getEpaycoCheckout(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() req: Request,
  ): Promise<string> {
    this.logger.log(
      `GET /payments/${paymentId}/epayco-checkout - user=${user.sub}`,
    );
    const backendUrl = `${req.protocol}://${req.get('host')}/api`;
    return this.paymentsService.getEpaycoCheckoutHtml(
      paymentId,
      this.getUserId(user),
      backendUrl,
    );
  }

  // ──────────────────────────── ePayco Webhook ────────────────────────────

  /**
   * Endpoint de confirmación para ePayco.
   * No requiere autenticación JWT (ePayco llama desde sus servidores).
   * Siempre responde 200 con { received: true } para evitar reintentos.
   */
  @Public()
  @Post('epayco/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook de confirmación de pago ePayco',
    description:
      'ePayco llama a este endpoint tras procesar una transacción. ' +
      'No requiere autenticación. Actualiza el estado del pago y ' +
      'emite el evento WebSocket payment_completed.',
  })
  @ApiOkResponse({
    description: 'Webhook procesado correctamente',
    schema: { example: { received: true } },
  })
  async epaycoWebhook(
    @Body() dto: EpaycoWebhookDto,
  ): Promise<{ received: boolean }> {
    this.logger.log(
      `POST /payments/epayco/webhook ref=${dto.x_ref_payco} response=${dto.x_response}`,
    );
    return this.paymentsService.processEpaycoWebhook(dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaymentEntity, UserPaymentMethodEntity } from '@/database/entities';
import { RoleName } from '@/database/enums';
import { CurrentUser } from '../../auth/infrastructure/decorators';
import { Roles } from '../../auth/infrastructure/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { JwtPayloadEntity } from '../../auth/domain/entities';
import {
  CreatePaymentDto,
  CreatePaymentMethodDto,
  PaymentsService,
  UpdatePaymentStatusDto,
} from '../application';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private getUserId(user: JwtPayloadEntity): string {
    if (!user.sub) {
      throw new ForbiddenException(
        'No se pudo resolver el usuario autenticado',
      );
    }
    return user.sub;
  }

  @Get('methods/available')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Listar métodos de pago disponibles para el usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Métodos disponibles por tipo de usuario',
    type: String,
    isArray: true,
  })
  async getAvailableMethods(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<string[]> {
    return this.paymentsService.getAvailableMethodsForUser(
      this.getUserId(user),
    );
  }

  @Get('methods/mine')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({ summary: 'Obtener métodos de pago guardados por el usuario' })
  @ApiOkResponse({ type: UserPaymentMethodEntity, isArray: true })
  async getMyMethods(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<UserPaymentMethodEntity[]> {
    return this.paymentsService.getMyPaymentMethods(this.getUserId(user));
  }

  @Post('methods')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un método de pago para el usuario' })
  @ApiCreatedResponse({ type: UserPaymentMethodEntity })
  async createMethod(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: CreatePaymentMethodDto,
  ): Promise<UserPaymentMethodEntity> {
    return this.paymentsService.createPaymentMethod(this.getUserId(user), dto);
  }

  @Patch('methods/:paymentMethodId/default')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({ summary: 'Marcar un método guardado como predeterminado' })
  @ApiOkResponse({ type: UserPaymentMethodEntity })
  async setDefaultMethod(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentMethodId') paymentMethodId: string,
  ): Promise<UserPaymentMethodEntity> {
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
  async deleteMethod(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentMethodId') paymentMethodId: string,
  ): Promise<void> {
    await this.paymentsService.disablePaymentMethod(
      this.getUserId(user),
      paymentMethodId,
    );
  }

  @Get('mine')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({ summary: 'Listar pagos del usuario autenticado' })
  @ApiOkResponse({ type: PaymentEntity, isArray: true })
  async getMyPayments(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<PaymentEntity[]> {
    return this.paymentsService.getMyPayments(this.getUserId(user));
  }

  @Post()
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear registro de pago para una solicitud de servicio',
  })
  @ApiCreatedResponse({ type: PaymentEntity })
  async createPayment(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentEntity> {
    return this.paymentsService.createPayment(this.getUserId(user), dto);
  }

  @Patch(':paymentId/status')
  @Roles(RoleName.USER, RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({ summary: 'Actualizar estado transaccional del pago' })
  @ApiOkResponse({ type: PaymentEntity })
  async updateStatus(
    @CurrentUser() user: JwtPayloadEntity,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdatePaymentStatusDto,
  ): Promise<PaymentEntity> {
    return this.paymentsService.updatePaymentStatus(
      this.getUserId(user),
      paymentId,
      dto,
    );
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayloadEntity } from '../../auth/domain/entities';
import { CurrentUser } from '../../auth/infrastructure/decorators';
import { JwtAuthGuard } from '../../auth/infrastructure/guards';
import { ServiceRequestsGateway } from '../../service-requests/presentation/gateways/service-requests.gateway';
import { ChatService } from '../application/chat.service';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly gateway: ServiceRequestsGateway,
  ) {}

  @Get(':serviceRequestId/messages')
  @ApiOperation({ summary: 'Obtener historial de mensajes de una solicitud' })
  @ApiOkResponse({ type: [ChatMessageResponseDto] })
  @ApiParam({ name: 'serviceRequestId', format: 'uuid' })
  getMessages(
    @Param('serviceRequestId', ParseUUIDPipe) serviceRequestId: string,
  ) {
    this.logger.log(`GET /chat/${serviceRequestId}/messages`);
    return this.chatService.getMessages(serviceRequestId);
  }

  @Post(':serviceRequestId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar mensaje de chat' })
  @ApiCreatedResponse({ type: ChatMessageResponseDto })
  @ApiParam({ name: 'serviceRequestId', format: 'uuid' })
  async sendMessage(
    @Param('serviceRequestId', ParseUUIDPipe) serviceRequestId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayloadEntity,
  ) {
    if (!user.sub) {
      throw new BadRequestException('User ID (sub) not found in token.');
    }
    this.logger.log(
      `POST /chat/${serviceRequestId}/messages - sender=${user.sub}`,
    );
    const saved = await this.chatService.sendMessage(
      serviceRequestId,
      user.sub,
      dto.content,
    );
    this.gateway.emitChatMessage(serviceRequestId, {
      id: saved.id,
      senderId: saved.senderId,
      content: saved.content,
      isRead: saved.isRead,
      sentAt: saved.sentAt,
    });
    return saved;
  }

  @Patch(':serviceRequestId/messages/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar mensajes como leídos' })
  @ApiParam({ name: 'serviceRequestId', format: 'uuid' })
  async markAsRead(
    @Param('serviceRequestId', ParseUUIDPipe) serviceRequestId: string,
    @CurrentUser() user: JwtPayloadEntity,
  ) {
    if (!user.sub) {
      throw new BadRequestException('User ID (sub) not found in token.');
    }
    this.logger.log(
      `PATCH /chat/${serviceRequestId}/messages/read - userId=${user.sub}`,
    );
    await this.chatService.markAsRead(serviceRequestId, user.sub);
  }
}

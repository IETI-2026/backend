import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import type { AcceptedTechnicianUserDto } from '../../application/dtos/accepted-technician-user.dto';
import type { ServiceRequestResponseDto } from '../../application/dtos/service-request-response.dto';

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
  },
  transports: ['websocket', 'polling'],
})
export class ServiceRequestsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ServiceRequestsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client attempting connection: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_request_room')
  handleJoinRequestRoom(
    @MessageBody() data: { requestId: string },
    @ConnectedSocket() client: Socket,
  ): { success: boolean; room: string } {
    const room = `request_${data.requestId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('join_technician_room')
  handleJoinTechnicianRoom(
    @MessageBody() data: { technicianId: string; tenantId: string },
    @ConnectedSocket() client: Socket,
  ): { success: boolean } {
    const authenticatedUserId = client.data.user?.sub as string | undefined;
    if (authenticatedUserId !== data.technicianId) {
      this.logger.warn(
        `WS join_technician_room: user=${authenticatedUserId} tried to join as technicianId=${data.technicianId}`,
      );
      client.emit('error', { message: 'Unauthorized: technicianId mismatch' });
      return { success: false };
    }

    const technicianRoom = `technician_${data.technicianId}`;
    const tenantRoom = `tenant_${data.tenantId}_technicians`;
    void client.join(technicianRoom);
    void client.join(tenantRoom);
    this.logger.log(
      `Technician ${data.technicianId} joined rooms ${technicianRoom}, ${tenantRoom}`,
    );
    return { success: true };
  }

  private roomSize(room: string): number {
    return this.server.sockets.adapter.rooms.get(room)?.size ?? 0;
  }

  emitNewServiceRequest(
    tenantId: string,
    serviceRequest: ServiceRequestResponseDto,
  ): void {
    const room = `tenant_${tenantId}_technicians`;
    this.logger.log(
      `Room ${room} has ${this.roomSize(room)} connected clients`,
    );
    this.server.to(room).emit('new_service_request', serviceRequest);
    this.logger.log(`Emitted new_service_request to room ${room}`);
  }

  emitTechnicianAccepted(
    requestId: string,
    technician: AcceptedTechnicianUserDto,
  ): void {
    const room = `request_${requestId}`;
    this.logger.log(
      `Room ${room} has ${this.roomSize(room)} connected clients`,
    );
    this.server.to(room).emit('technician_accepted', technician);
    this.logger.log(`Emitted technician_accepted to room ${room}`);
  }

  emitLocationUpdated(
    requestId: string,
    data: {
      userId: string;
      role: string;
      latitude: number;
      longitude: number;
    },
  ): void {
    const room = `request_${requestId}`;
    this.logger.log(
      `Room ${room} has ${this.roomSize(room)} connected clients`,
    );
    this.server.to(room).emit('location_updated', data);
    this.logger.log(`Emitted location_updated to room ${room}`);
  }

  emitServiceStatusUpdated(requestId: string, status: string): void {
    const room = `request_${requestId}`;
    this.logger.log(
      `Room ${room} has ${this.roomSize(room)} connected clients`,
    );
    this.server.to(room).emit('service_status_updated', { requestId, status });
    this.logger.log(
      `Emitted service_status_updated to room ${room}: ${status}`,
    );
  }

  emitTechnicianStatsUpdated(
    technicianId: string,
    servicesCount: number,
  ): void {
    const room = `technician_${technicianId}`;
    this.logger.log(
      `Room ${room} has ${this.roomSize(room)} connected clients`,
    );
    this.server.to(room).emit('technician_stats_updated', { servicesCount });
    this.logger.log(
      `Emitted technician_stats_updated to room ${room}: servicesCount=${servicesCount}`,
    );
  }

  emitPaymentCompleted(
    serviceRequestId: string,
    data: {
      paymentId: string;
      amount: number;
      method: string;
      status: string;
      paidAt: Date;
    },
  ): void {
    const room = `request_${serviceRequestId}`;
    this.logger.log(
      `Room ${room} has ${this.roomSize(room)} connected clients`,
    );
    this.server.to(room).emit('payment_completed', {
      serviceRequestId,
      ...data,
    });
    this.logger.log(
      `Emitted payment_completed to room ${room}: paymentId=${data.paymentId} status=${data.status}`,
    );
  }
}

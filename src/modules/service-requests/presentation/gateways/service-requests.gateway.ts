import { Logger } from '@nestjs/common';
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
import type { AcceptedTechnicianUserDto } from '../../application/dtos/accepted-technician-user.dto';
import type { ServiceRequestResponseDto } from '../../application/dtos/service-request-response.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
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
    this.logger.log(`Client connected: ${client.id}`);
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
    const technicianRoom = `technician_${data.technicianId}`;
    const tenantRoom = `tenant_${data.tenantId}_technicians`;
    void client.join(technicianRoom);
    void client.join(tenantRoom);
    this.logger.log(
      `Technician ${data.technicianId} joined rooms ${technicianRoom}, ${tenantRoom}`,
    );
    return { success: true };
  }

  emitNewServiceRequest(
    tenantId: string,
    serviceRequest: ServiceRequestResponseDto,
  ): void {
    const room = `tenant_${tenantId}_technicians`;
    this.server.to(room).emit('new_service_request', serviceRequest);
    this.logger.log(`Emitted new_service_request to room ${room}`);
  }

  emitTechnicianAccepted(
    requestId: string,
    technician: AcceptedTechnicianUserDto,
  ): void {
    const room = `request_${requestId}`;
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
    this.server.to(room).emit('location_updated', data);
  }

  emitServiceStatusUpdated(requestId: string, status: string): void {
    const room = `request_${requestId}`;
    this.server.to(room).emit('service_status_updated', { requestId, status });
    this.logger.log(
      `Emitted service_status_updated to room ${room}: ${status}`,
    );
  }
}

import { ApiProperty } from '@nestjs/swagger';

export class ChatSenderDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) profilePhotoUrl!: string | null;
}

export class ChatMessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() serviceRequestId!: string;
  @ApiProperty() senderId!: string;
  @ApiProperty() content!: string;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ nullable: true }) readAt!: Date | null;
  @ApiProperty() sentAt!: Date;
  @ApiProperty({ type: ChatSenderDto, nullable: true })
  sender!: ChatSenderDto | null;
}

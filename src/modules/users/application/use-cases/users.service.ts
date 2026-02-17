import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { IUserRepository } from "@users/domain";
import { USER_REPOSITORY, UserStatus } from "@users/domain";
import type { CreateUserDto, GetUsersQueryDto, UpdateUserDto } from "../dtos";
import { UserResponseDto } from "../dtos";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log(`Creating user with email: ${createUserDto.email}`);

    if (
      createUserDto.currentLatitude !== undefined ||
      createUserDto.currentLongitude !== undefined
    ) {
      createUserDto = {
        ...createUserDto,
        lastLocationUpdate: new Date(),
      };
    }

    if (createUserDto.email) {
      const existingUserByEmail = await this.userRepository.findByEmail(
        createUserDto.email,
      );
      if (existingUserByEmail) {
        throw new ConflictException("Email already in use");
      }
    }

    if (createUserDto.phoneNumber) {
      const existingUserByPhone = await this.userRepository.findByPhoneNumber(
        createUserDto.phoneNumber,
      );
      if (existingUserByPhone) {
        throw new ConflictException("Phone number already in use");
      }
    }

    if (createUserDto.documentId) {
      const existingUserByDoc = await this.userRepository.findByDocumentId(
        createUserDto.documentId,
      );
      if (existingUserByDoc) {
        throw new ConflictException("Document ID already in use");
      }
    }

    const user = await this.userRepository.create(createUserDto);
    this.logger.log(`User created successfully with ID: ${user.id}`);

    return this.mapToResponse(user);
  }

  async findAll(query: GetUsersQueryDto): Promise<{
    users: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 0, limit = 10, status } = query;
    const skip = page * limit;

    const { users, total } = await this.userRepository.findAll({
      skip,
      take: limit,
      status,
    });

    return {
      users: users.map((user) => this.mapToResponse(user)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.mapToResponse(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return this.mapToResponse(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating user with ID: ${id}`);

    if (
      updateUserDto.currentLatitude !== undefined ||
      updateUserDto.currentLongitude !== undefined
    ) {
      updateUserDto = {
        ...updateUserDto,
        lastLocationUpdate: new Date(),
      };
    }

    // Verificar que el usuario existe
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validar unicidad de email si se está actualizando
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const userWithEmail = await this.userRepository.findByEmail(
        updateUserDto.email,
      );
      if (userWithEmail && userWithEmail.id !== id) {
        throw new ConflictException("Email already in use");
      }
    }

    // Validar unicidad de teléfono si se está actualizando
    if (
      updateUserDto.phoneNumber &&
      updateUserDto.phoneNumber !== existingUser.phoneNumber
    ) {
      const userWithPhone = await this.userRepository.findByPhoneNumber(
        updateUserDto.phoneNumber,
      );
      if (userWithPhone && userWithPhone.id !== id) {
        throw new ConflictException("Phone number already in use");
      }
    }

    const user = await this.userRepository.update(id, updateUserDto);
    this.logger.log(`User updated successfully with ID: ${id}`);

    return this.mapToResponse(user);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Soft deleting user with ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.softDelete(id);
    this.logger.log(`User soft deleted successfully with ID: ${id}`);
  }

  async hardDelete(id: string): Promise<void> {
    this.logger.log(`Hard deleting user with ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.delete(id);
    this.logger.log(`User hard deleted successfully with ID: ${id}`);
  }

  private mapToResponse(user: {
    id: string;
    email: string | null;
    phoneNumber: string | null;
    fullName: string;
    documentId: string | null;
    profilePhotoUrl: string | null;
    skills: string[];
    currentLatitude: number | null;
    currentLongitude: number | null;
    lastLocationUpdate: Date | null;
    status: UserStatus;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }): UserResponseDto {
    const response = new UserResponseDto();
    response.id = user.id;
    response.email = user.email;
    response.phoneNumber = user.phoneNumber;
    response.fullName = user.fullName;
    response.documentId = user.documentId;
    response.profilePhotoUrl = user.profilePhotoUrl;
    response.skills = user.skills;
    response.currentLatitude = user.currentLatitude;
    response.currentLongitude = user.currentLongitude;
    response.lastLocationUpdate = user.lastLocationUpdate;
    response.status = user.status;
    response.emailVerified = user.emailVerified;
    response.phoneVerified = user.phoneVerified;
    response.createdAt = user.createdAt;
    response.updatedAt = user.updatedAt;
    response.lastLoginAt = user.lastLoginAt;
    return response;
  }
}

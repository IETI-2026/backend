import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '@users/application';
import { RoleName } from '../../../../../database/enums';
import { JwtPayloadEntity } from '../../../../auth/domain/entities';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { UsersController } from '../users.controller';

const mockUserResponse = {
  id: 'user-uuid-001',
  email: 'admin@example.com',
  fullName: 'Admin User',
  roles: [RoleName.ADMIN],
  status: 'ACTIVE',
};

const adminUser: JwtPayloadEntity = {
  sub: 'user-uuid-001',
  email: 'admin@example.com',
  roles: [RoleName.ADMIN],
};

const regularUser: JwtPayloadEntity = {
  sub: 'user-uuid-002',
  email: 'user@example.com',
  roles: [RoleName.USER],
};

const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  updateProfile: jest.fn(),
  remove: jest.fn(),
  hardDelete: jest.fn(),
};

const allowAllGuard = { canActivate: () => true };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      email: 'new@example.com',
      password: 'Pass123!',
      fullName: 'New User',
    };

    it('should create and return a new user', async () => {
      mockUsersService.create.mockResolvedValue(mockUserResponse);

      const result = await controller.create(createDto as unknown, adminUser);

      expect(mockUsersService.create).toHaveBeenCalledWith(createDto);
      expect(result).toBe(mockUserResponse);
    });

    it('should propagate ConflictException when email is already in use', async () => {
      mockUsersService.create.mockRejectedValue(
        new ConflictException('Email already in use'),
      );

      await expect(
        controller.create(createDto as unknown, adminUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      const paginatedResult = {
        users: [mockUserResponse],
        total: 1,
        page: 0,
        limit: 10,
      };
      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({} as unknown, adminUser);

      expect(mockUsersService.findAll).toHaveBeenCalledWith({});
      expect(result.total).toBe(1);
      expect(result.users).toHaveLength(1);
    });

    it('should pass query filters to the service', async () => {
      mockUsersService.findAll.mockResolvedValue({
        users: [],
        total: 0,
        page: 1,
        limit: 5,
      });
      const query = { page: 1, limit: 5, status: 'ACTIVE' } as unknown;

      await controller.findAll(query, adminUser);

      expect(mockUsersService.findAll).toHaveBeenCalledWith(query);
    });

    it('should propagate service errors', async () => {
      mockUsersService.findAll.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        controller.findAll({} as unknown, adminUser),
      ).rejects.toThrow('DB connection lost');
    });
  });

  describe('getMe', () => {
    it('should return the current user profile', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.getMe(regularUser);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(regularUser.sub);
      expect(result).toBe(mockUserResponse);
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const noSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(controller.getMe(noSub)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockUsersService.findOne).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when user no longer exists', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getMe(regularUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    const updateDto = { fullName: 'Updated Name' };

    it('should update and return the current user profile', async () => {
      const updated = { ...mockUserResponse, fullName: 'Updated Name' };
      mockUsersService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateMe(
        regularUser,
        updateDto as unknown,
      );

      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        regularUser.sub,
        updateDto,
      );
      expect(result.fullName).toBe('Updated Name');
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const noSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(
        controller.updateMe(noSub, updateDto as unknown),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUsersService.updateProfile).not.toHaveBeenCalled();
    });

    it('should propagate ConflictException when phone is already in use', async () => {
      mockUsersService.updateProfile.mockRejectedValue(
        new ConflictException('Phone already in use'),
      );

      await expect(
        controller.updateMe(regularUser, {
          phoneNumber: '+573001111111',
        } as unknown),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByEmail', () => {
    it('should return the user matching the given email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUserResponse);

      const result = await controller.findByEmail(
        'admin@example.com',
        adminUser,
      );

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'admin@example.com',
      );
      expect(result).toBe(mockUserResponse);
    });

    it('should propagate NotFoundException when email does not exist', async () => {
      mockUsersService.findByEmail.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.findByEmail('nobody@example.com', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return the user matching the given ID', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.findOne('user-uuid-001', adminUser);

      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-uuid-001');
      expect(result).toBe(mockUserResponse);
    });

    it('should propagate NotFoundException for unknown ID', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.findOne('non-existent-id', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { fullName: 'Updated Name' };

    it('should update the user and return the updated record', async () => {
      const updated = { ...mockUserResponse, fullName: 'Updated Name' };
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.update(
        'user-uuid-001',
        updateDto as unknown,
        adminUser,
      );

      expect(mockUsersService.update).toHaveBeenCalledWith(
        'user-uuid-001',
        updateDto,
      );
      expect(result.fullName).toBe('Updated Name');
    });

    it('should propagate NotFoundException for unknown ID', async () => {
      mockUsersService.update.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.update('bad-id', updateDto as unknown, adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call usersService.remove with the correct ID', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('user-uuid-001', adminUser);

      expect(mockUsersService.remove).toHaveBeenCalledWith('user-uuid-001');
      expect(result).toBeUndefined();
    });

    it('should propagate NotFoundException for unknown ID', async () => {
      mockUsersService.remove.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.remove('bad-id', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete the user', async () => {
      mockUsersService.hardDelete.mockResolvedValue(undefined);

      const result = await controller.hardDelete('user-uuid-001', adminUser);

      expect(mockUsersService.hardDelete).toHaveBeenCalledWith('user-uuid-001');
      expect(result).toBeUndefined();
    });

    it('should propagate NotFoundException for unknown ID', async () => {
      mockUsersService.hardDelete.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.hardDelete('bad-id', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

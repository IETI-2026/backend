import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayloadEntity } from '../../../../auth/domain/entities';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards';
import { AddressesService } from '../../../application';
import { AddressesController } from '../addresses.controller';

const mockUser: JwtPayloadEntity = { sub: 'user-1', email: 'user@test.com' };

const mockAddress = {
  id: 'addr-1',
  userId: 'user-1',
  street: 'Calle 1',
  city: 'Bogotá',
  neighborhood: null,
  department: null,
  country: 'CO',
  postalCode: null,
  label: null,
  latitude: 4.711,
  longitude: -74.072,
  isDefault: false,
  createdAt: new Date('2024-01-01'),
};

const mockAddressesService = {
  findByUser: jest.fn(),
  create: jest.fn(),
  setDefault: jest.fn(),
  remove: jest.fn(),
};

describe('AddressesController', () => {
  let controller: AddressesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        { provide: AddressesService, useValue: mockAddressesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AddressesController>(AddressesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all addresses for the authenticated user', async () => {
      mockAddressesService.findByUser.mockResolvedValue([mockAddress]);

      const result = await controller.findAll(mockUser);

      expect(mockAddressesService.findByUser).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('addr-1');
    });

    it('should throw UnauthorizedException when user has no sub', () => {
      expect(() => controller.findAll({ ...mockUser, sub: undefined })).toThrow(
        UnauthorizedException,
      );
      expect(mockAddressesService.findByUser).not.toHaveBeenCalled();
    });

    it('should return an empty array when the user has no addresses', async () => {
      mockAddressesService.findByUser.mockResolvedValue([]);

      const result = await controller.findAll(mockUser);

      expect(result).toHaveLength(0);
    });

    it('should propagate service errors', async () => {
      mockAddressesService.findByUser.mockRejectedValue(new Error('DB error'));

      await expect(controller.findAll(mockUser)).rejects.toThrow('DB error');
    });
  });

  describe('create', () => {
    const createDto = { street: 'Calle 80', city: 'Bogotá' };

    it('should create and return a new address', async () => {
      mockAddressesService.create.mockResolvedValue(mockAddress);

      const result = await controller.create(mockUser, createDto as never);

      expect(mockAddressesService.create).toHaveBeenCalledWith(
        'user-1',
        createDto,
      );
      expect(result).toEqual(mockAddress);
    });

    it('should throw UnauthorizedException when user has no sub', () => {
      expect(() =>
        controller.create({ ...mockUser, sub: undefined }, createDto as never),
      ).toThrow(UnauthorizedException);
      expect(mockAddressesService.create).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      mockAddressesService.create.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.create(mockUser, createDto as never),
      ).rejects.toThrow('DB error');
    });
  });

  describe('setDefault', () => {
    it('should set an address as default and return the updated address', async () => {
      const updated = { ...mockAddress, isDefault: true };
      mockAddressesService.setDefault.mockResolvedValue(updated);

      const result = await controller.setDefault('addr-1', mockUser);

      expect(mockAddressesService.setDefault).toHaveBeenCalledWith(
        'addr-1',
        'user-1',
      );
      expect(result.isDefault).toBe(true);
    });

    it('should throw UnauthorizedException when user has no sub', () => {
      expect(() =>
        controller.setDefault('addr-1', { ...mockUser, sub: undefined }),
      ).toThrow(UnauthorizedException);
      expect(mockAddressesService.setDefault).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException for an unknown address', async () => {
      mockAddressesService.setDefault.mockRejectedValue(
        new NotFoundException('Address not found'),
      );

      await expect(controller.setDefault('bad-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate ForbiddenException when user does not own the address', async () => {
      mockAddressesService.setDefault.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(controller.setDefault('addr-1', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an address and return void', async () => {
      mockAddressesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('addr-1', mockUser);

      expect(mockAddressesService.remove).toHaveBeenCalledWith(
        'addr-1',
        'user-1',
      );
      expect(result).toBeUndefined();
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      await expect(
        controller.remove('addr-1', { ...mockUser, sub: undefined }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAddressesService.remove).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException for an unknown address', async () => {
      mockAddressesService.remove.mockRejectedValue(
        new NotFoundException('Address not found'),
      );

      await expect(controller.remove('bad-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate ForbiddenException when user does not own the address', async () => {
      mockAddressesService.remove.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(controller.remove('addr-1', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

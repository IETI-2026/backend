import type {
  CreateUserEntity,
  UpdateUserEntity,
  UserEntity,
} from '../entities';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface IUserRepository {
  create(data: CreateUserEntity): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByPhoneNumber(phoneNumber: string): Promise<UserEntity | null>;
  findByDocumentId(documentId: string): Promise<UserEntity | null>;
  findAll(params: {
    skip?: number;
    take?: number;
    status?: string;
  }): Promise<{ users: UserEntity[]; total: number }>;
  update(id: string, data: UpdateUserEntity): Promise<UserEntity>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<UserEntity>;
  exists(id: string): Promise<boolean>;
}

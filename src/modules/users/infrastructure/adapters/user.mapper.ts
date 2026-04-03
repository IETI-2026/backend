import type {
  CreateUserEntity,
  UpdateUserEntity,
  UserEntity,
} from '@users/domain';
import { UserStatus } from '@users/domain';
import { UserEntity as DbUserEntity } from '@/database/entities';
import { UserStatus as DbUserStatus } from '@/database/enums';

export function toDomain(dbUser: DbUserEntity): UserEntity {
  return {
    id: dbUser.id,
    email: dbUser.email,
    phoneNumber: dbUser.phoneNumber,
    fullName: dbUser.fullName,
    documentId: dbUser.documentId,
    profilePhotoUrl: dbUser.profilePhotoUrl,
    skills: dbUser.skills,
    currentLatitude: dbUser.currentLatitude,
    currentLongitude: dbUser.currentLongitude,
    lastLocationUpdate: dbUser.lastLocationUpdate,
    status: dbUser.status as UserStatus,
    emailVerified: dbUser.emailVerified,
    phoneVerified: dbUser.phoneVerified,
    servicesCount: dbUser.servicesCount ?? 0,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
    lastLoginAt: dbUser.lastLoginAt,
    deletedAt: dbUser.deletedAt,
  };
}

export function toCreateData(data: CreateUserEntity) {
  return {
    email: data.email,
    phoneNumber: data.phoneNumber,
    passwordHash: data.passwordHash,
    fullName: data.fullName,
    documentId: data.documentId,
    profilePhotoUrl: data.profilePhotoUrl,
    skills: data.skills,
    currentLatitude: data.currentLatitude,
    currentLongitude: data.currentLongitude,
    lastLocationUpdate: data.lastLocationUpdate,
    status: data.status as DbUserStatus | undefined,
  };
}

export function toUpdateData(data: UpdateUserEntity) {
  return {
    email: data.email,
    phoneNumber: data.phoneNumber,
    fullName: data.fullName,
    documentId: data.documentId,
    profilePhotoUrl: data.profilePhotoUrl,
    skills: data.skills,
    currentLatitude: data.currentLatitude,
    currentLongitude: data.currentLongitude,
    lastLocationUpdate: data.lastLocationUpdate,
    status: data.status as DbUserStatus | undefined,
    emailVerified: data.emailVerified,
    phoneVerified: data.phoneVerified,
    lastLoginAt: data.lastLoginAt,
  };
}

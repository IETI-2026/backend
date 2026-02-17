import { UserStatus } from "../enums";

export interface UserEntity {
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
  deletedAt: Date | null;
}

export interface CreateUserEntity {
  email?: string;
  phoneNumber?: string;
  passwordHash?: string;
  fullName: string;
  documentId?: string;
  profilePhotoUrl?: string;
  skills?: string[];
  currentLatitude?: number;
  currentLongitude?: number;
  lastLocationUpdate?: Date;
  status?: UserStatus;
}

export interface UpdateUserEntity {
  email?: string;
  phoneNumber?: string;
  fullName?: string;
  documentId?: string;
  profilePhotoUrl?: string;
  skills?: string[];
  currentLatitude?: number;
  currentLongitude?: number;
  lastLocationUpdate?: Date;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  lastLoginAt?: Date;
}

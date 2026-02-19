import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  AUTH_RESPONSE_EXPIRES_IN_SECONDS,
  JWT_ACCESS_TOKEN_EXPIRES_IN,
  JWT_REFRESH_TOKEN_EXPIRES_IN,
  OTP_CODE_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../../domain/constants';
import { JwtPayloadEntity } from '../../domain/entities';
import {
  AUTH_REPOSITORY,
  type IAuthRepository,
} from '../../domain/repositories';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SendOtpDto,
  SignUpDto,
  VerifyOtpDto,
} from '../dtos';

// User response type for getCurrentUser method
export interface UserResponse {
  id: string;
  email: string | null;
  fullName: string;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
  roles: string[];
  createdAt: Date;
  lastLoginAt: Date | null;
}

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 10;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: IAuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
    const { email, password, fullName, phoneNumber } = signUpDto;

    const existingUser = await this.authRepository.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.hashPassword(password);

    const user = await this.authRepository.createUser({
      email: email || '',
      fullName: fullName || '',
      passwordHash,
      phoneNumber,
      emailVerified: false,
    });

    return this.generateAuthResponse(user.id, user.email || '');
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.authRepository.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.comparePassword(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.authRepository.updateUser(user.id, {
      lastLoginAt: new Date(),
    });

    return this.generateAuthResponse(user.id, user.email || '');
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const storedToken =
        await this.authRepository.findRefreshToken(refreshToken);
      if (
        !storedToken ||
        storedToken.isRevoked ||
        new Date() > storedToken.expiresAt
      ) {
        throw new UnauthorizedException('Refresh token expired or revoked');
      }

      const user = await this.authRepository.findUserById(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateAuthResponse(user.id, user.email || '');
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async handleGoogleOAuthCallback(profile: {
    providerId: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string;
    accessToken: string;
    refreshToken?: string;
  }): Promise<AuthResponseDto> {
    const { providerId, email, fullName, accessToken, refreshToken } = profile;

    const oauthAccount = await this.authRepository.findOAuthAccount(
      'GOOGLE',
      providerId,
    );

    if (oauthAccount) {
      const user = await this.authRepository.findUserById(oauthAccount.userId);
      if (!user) {
        throw new UnauthorizedException(
          'User associated with OAuth account not found',
        );
      }

      if (accessToken) {
        await this.authRepository.createOAuthAccount({
          userId: user.id,
          provider: 'GOOGLE',
          providerUserId: providerId,
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        });
      }

      return this.generateAuthResponse(user.id, user.email || '');
    }

    let user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      user = await this.authRepository.createUser({
        email,
        fullName,
        emailVerified: true,
      });
    }

    await this.authRepository.createOAuthAccount({
      userId: user.id,
      provider: 'GOOGLE',
      providerUserId: providerId,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });

    return this.generateAuthResponse(user.id, user.email || '');
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.authRepository.revokeRefreshToken(tokenId);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.authRepository.revokeAllUserRefreshTokens(userId);
    return { message: 'Logout successful. All sessions revoked.' };
  }

  async sendOtp(
    dto: SendOtpDto,
  ): Promise<{ message: string; expiresInSeconds: number }> {
    await this.authRepository.invalidateOtpCodesForPhone(dto.phone);

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const user = await this.authRepository.findUserByPhone(dto.phone);

    await this.authRepository.createOtpCode({
      userId: user?.id,
      phone: dto.phone,
      code,
      expiresAt,
    });

    this.logger.warn(
      `[OTP SIMULADO] Código para ${dto.phone}: ${code} (expira en ${OTP_EXPIRY_MINUTES} min)`,
    );

    return {
      message: `OTP sent to ${dto.phone}`,
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    };
  }

  async verifyOtpAndLogin(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    const otp = await this.authRepository.findValidOtpCode(dto.phone, dto.code);
    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await this.authRepository.markOtpUsed(otp.id);
      throw new UnauthorizedException('Too many attempts. Request a new OTP.');
    }

    await this.authRepository.incrementOtpAttempts(otp.id);
    await this.authRepository.markOtpUsed(otp.id);

    let user = await this.authRepository.findUserByPhone(dto.phone);

    if (!user) {
      user = await this.authRepository.createUser({
        email: '',
        fullName: '',
        phoneNumber: dto.phone,
        emailVerified: false,
      });
      await this.authRepository.updateUser(user.id, {
        lastLoginAt: new Date(),
      });
    } else {
      await this.authRepository.updateUser(user.id, {
        lastLoginAt: new Date(),
      });
    }

    return this.generateAuthResponse(user.id, user.email || '');
  }

  private generateOtpCode(): string {
    const min = 10 ** (OTP_CODE_LENGTH - 1);
    const max = 10 ** OTP_CODE_LENGTH - 1;
    return String(Math.floor(min + Math.random() * (max - min + 1)));
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      return { message: 'If the email exists, you will receive a reset link' };
    }
    if (!user.passwordHash) {
      return { message: 'If the email exists, you will receive a reset link' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );
    await this.authRepository.createPasswordResetToken({
      userId: user.id,
      token,
      expiresAt,
    });

    const frontendUrl =
      this.configService.get<string>('oauth.frontend.url') ||
      'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;
    this.logger.log(
      `Password reset requested for ${dto.email}. Link (dev): ${resetLink}`,
    );
    return {
      message: 'If the email exists, you will receive a reset link',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this.authRepository.findValidPasswordResetToken(
      dto.token,
    );
    if (!record) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.authRepository.updateUser(record.userId, { passwordHash });
    await this.authRepository.markPasswordResetTokenUsed(record.id);
    return { message: 'Password has been reset successfully' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.authRepository.findUserById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found or has no password');
    }
    const isValid = await this.comparePassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.authRepository.updateUser(userId, { passwordHash });
    return { message: 'Password has been changed successfully' };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    const jwtPayload: JwtPayloadEntity = {
      sub: userId,
      email,
      roles: roles as RoleName[],
    };

    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: jwtSecret,
      expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshTokenPayload = {
      ...jwtPayload,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: refreshSecret,
      expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN,
    });

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.authRepository.createRefreshToken({
      userId,
      token: refreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private async generateAuthResponse(
    userId: string,
    email: string,
  ): Promise<AuthResponseDto> {
    const roles = await this.authRepository.getUserRoles(userId);

    const { accessToken, refreshToken } = await this.generateTokens(
      userId,
      email,
      roles,
    );

    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_RESPONSE_EXPIRES_IN_SECONDS,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email || '',
        fullName: user.fullName,
        profilePhotoUrl: user.profilePhotoUrl || undefined,
        roles: roles as RoleName[],
      },
    };
  }

  async validateJwtPayload(
    payload: JwtPayloadEntity,
  ): Promise<JwtPayloadEntity> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const roles = await this.authRepository.getUserRoles(user.id);
    return {
      sub: user.id,
      email: user.email || '',
      roles: roles as RoleName[],
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.authRepository.findUserWithRoles(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = user.roles?.map((ur) => ur.role.name) || [];

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      profilePhotoUrl: user.profilePhotoUrl,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      status: user.status,
      roles,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

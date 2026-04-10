import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleMobileLoginDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SendOtpDto,
  SignUpDto,
  VerifyOtpDto,
} from '../application/dtos';
import {
  AuthService,
  UserResponse,
} from '../application/services/auth.service';
import { JwtPayloadEntity } from '../domain/entities';
import { CurrentUser, Public } from '../infrastructure/decorators';
import { JwtAuthGuard, RolesGuard } from '../infrastructure/guards';

interface GoogleOAuthRequest extends Request {
  user?: {
    provider: string;
    providerId: string;
    email?: string;
    fullName: string;
    profilePhotoUrl?: string;
    accessToken: string;
    refreshToken?: string;
  };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async signUp(@Body() signUpDto: SignUpDto): Promise<AuthResponseDto> {
    this.logger.log(
      `POST /auth/signup - Registering user with email ${signUpDto.email}`,
    );
    return this.authService.signUp(signUpDto);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`POST /auth/login - Login attempt for ${loginDto.email}`);
    return this.authService.login(loginDto);
  }

  @Post('google/mobile')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Authenticate mobile user with Google ID token and return API session tokens',
  })
  @ApiResponse({ status: 200, description: 'Google mobile login successful' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleMobileLogin(
    @Body() googleMobileLoginDto: GoogleMobileLoginDto,
  ): Promise<AuthResponseDto> {
    this.logger.log('POST /auth/google/mobile - Google mobile login attempt');
    return this.authService.loginWithGoogleIdToken(
      googleMobileLoginDto.idToken,
    );
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    this.logger.log('POST /auth/refresh - Token refresh requested');
    if (!refreshTokenDto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'If email exists, reset link sent' })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log(
      `POST /auth/forgot-password - Password reset requested for ${forgotPasswordDto.email}`,
    );
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log('POST /auth/reset-password - Password reset with token');
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log(
      `POST /auth/change-password - Password change for user ${user.sub}`,
    );
    if (!user.sub) {
      throw new UnauthorizedException('User ID not available');
    }
    return this.authService.changePassword(user.sub, changePasswordDto);
  }

  @Post('send-otp')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Send OTP code to phone number (simulated)' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent (check server logs in dev)',
  })
  async sendOtp(
    @Body() sendOtpDto: SendOtpDto,
  ): Promise<{ message: string; expiresInSeconds: number }> {
    this.logger.log(`POST /auth/send-otp - Sending OTP to ${sendOtpDto.phone}`);
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify OTP and login (creates account if new phone)',
  })
  @ApiResponse({ status: 200, description: 'OTP verified, tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
  ): Promise<AuthResponseDto> {
    this.logger.log(
      `POST /auth/verify-otp - Verifying OTP for ${verifyOtpDto.phone}`,
    );
    return this.authService.verifyOtpAndLogin(verifyOtpDto);
  }

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Get Google OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'OAuth URL generated' })
  async getGoogleAuthUrl(): Promise<{ authUrl: string }> {
    this.logger.log('GET /auth/google - Generating Google OAuth URL');
    const clientId = this.configService.get<string>('oauth.google.clientId');
    const redirectUri = this.configService.get<string>(
      'oauth.google.callbackUrl',
    );

    if (!redirectUri) {
      throw new Error('Google OAuth callback URL is not configured');
    }

    const scope = encodeURIComponent('openid profile email');
    const state = Math.random().toString(36).substring(7);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `state=${state}`;

    return { authUrl };
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with tokens' })
  async googleCallback(
    @Req() req: GoogleOAuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(
      'GET /auth/google/callback - Processing Google OAuth callback',
    );
    if (!req.user) {
      throw new UnauthorizedException('Google authentication failed');
    }

    if (!req.user.email) {
      throw new UnauthorizedException(
        'Email is required for OAuth authentication',
      );
    }

    try {
      const authResponse = await this.authService.handleGoogleOAuthCallback({
        ...req.user,
        email: req.user.email,
      });

      if (!authResponse.user) {
        throw new UnauthorizedException('User data not available');
      }

      const frontendUrl = this.configService.get<string>('oauth.frontend.url');
      const redirectUrl =
        `${frontendUrl}/auth/callback?` +
        `accessToken=${authResponse.accessToken}&` +
        `refreshToken=${authResponse.refreshToken}&` +
        `expiresIn=${authResponse.expiresIn}&` +
        `userId=${authResponse.user.id}`;

      this.logger.log(
        `GET /auth/google/callback - OAuth successful for user ${authResponse.user.id}`,
      );
      res.redirect(redirectUrl);
    } catch (error) {
      const frontendUrl = this.configService.get<string>('oauth.frontend.url');
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      const errorUrl = `${frontendUrl}/auth/error?message=${encodeURIComponent(errorMessage)}`;
      this.logger.error(
        `GET /auth/google/callback - OAuth failed: ${errorMessage}`,
      );
      res.redirect(errorUrl);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user information' })
  @ApiResponse({ status: 200, description: 'User information retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<UserResponse> {
    this.logger.log(`GET /auth/me - Fetching current user ${user.sub}`);
    if (!user.sub) {
      throw new UnauthorizedException('User ID not available');
    }
    return this.authService.getCurrentUser(user.sub);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout user and revoke all refresh tokens' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful, all sessions revoked',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<{ message: string }> {
    this.logger.log(`POST /auth/logout - Logging out user ${user.sub}`);
    if (!user.sub) {
      throw new UnauthorizedException('User ID not available');
    }
    return this.authService.logout(user.sub);
  }
}

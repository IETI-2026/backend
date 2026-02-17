import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { RoleName } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  AuthResponseDto,
  LoginDto,
  RefreshTokenDto,
  SignUpDto,
} from '../application/dtos';
import {
  AuthService,
  UserResponse,
} from '../application/services/auth.service';
import { JwtPayloadEntity } from '../domain/entities';
import { CurrentUser, Public, Roles } from '../infrastructure/decorators';
import { JwtAuthGuard, RolesGuard } from '../infrastructure/guards';

// Interface for Google OAuth callback request
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
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  @Public()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async signUp(@Body() signUpDto: SignUpDto): Promise<AuthResponseDto> {
    return this.authService.signUp(signUpDto);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    if (!refreshTokenDto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Get Google OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'OAuth URL generated' })
  async getGoogleAuthUrl(): Promise<{ authUrl: string }> {
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
        email: req.user.email, // Ensure email is defined
      });

      if (!authResponse.user) {
        throw new UnauthorizedException('User data not available');
      }

      const frontendUrl =
        this.configService.get<string>('frontend.url') ||
        'http://localhost:3000';
      const redirectUrl =
        `${frontendUrl}/auth/callback?` +
        `accessToken=${authResponse.accessToken}&` +
        `refreshToken=${authResponse.refreshToken}&` +
        `expiresIn=${authResponse.expiresIn}&` +
        `userId=${authResponse.user.id}`;

      res.redirect(redirectUrl);
    } catch (error) {
      const frontendUrl =
        this.configService.get<string>('frontend.url') ||
        'http://localhost:3000';
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      const errorUrl = `${frontendUrl}/auth/error?message=${encodeURIComponent(errorMessage)}`;
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
    if (!user.sub) {
      throw new UnauthorizedException('User ID not available');
    }
    return this.authService.getCurrentUser(user.sub);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout user (revoke refresh token)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser() _user: JwtPayloadEntity,
  ): Promise<{ message: string }> {
    // TODO: Revoke the user's refresh token(s) in the database
    return { message: 'Logout successful' };
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users list retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async adminListUsers(
    @CurrentUser() _user: JwtPayloadEntity,
  ): Promise<{ message: string }> {
    return { message: 'Admin endpoint - users list' };
  }

  @Post('admin/verify-provider/:providerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a provider (Moderator/Admin only)' })
  @ApiResponse({ status: 200, description: 'Provider verified' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Moderator/Admin role required',
  })
  async verifyProvider(
    @CurrentUser() _user: JwtPayloadEntity,
    @Req() _req: Request,
  ): Promise<{ message: string }> {
    return { message: 'Provider verification endpoint' };
  }
}

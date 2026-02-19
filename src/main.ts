import { AllExceptionsFilter } from '@common/filters';
import { LoggingInterceptor } from '@common/interceptors';
import type { LogLevel } from '@nestjs/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

function getLogLevels(env: string): LogLevel[] {
  if (env === 'production') {
    return ['log', 'warn', 'error'];
  }
  return ['log', 'warn', 'error', 'debug', 'verbose'];
}

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: getLogLevels(nodeEnv),
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.enableShutdownHooks();

  app.use(helmet());
  app.use(compression());

  const allowedOrigins = configService.get<string>('app.corsOrigins');
  app.enableCors({
    origin: isProduction
      ? allowedOrigins?.split(',').map((o) => o.trim()) || false
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: ['/', 'health'],
  });

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Cameyo API')
      .setDescription('API de la plataforma Cameyo - Servicios bajo demanda')
      .setVersion('1.0')
      .addTag('Authentication', 'Registro, login, OAuth, OTP y gestión de tokens')
      .addTag('users', 'Gestión de usuarios y perfiles')
      .addTag('provider-profile', 'Perfil de prestador de servicios')
      .addTag('service-requests', 'Solicitudes de servicio')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Cameyo API Docs',
    });

    logger.log(`API Documentation: http://localhost:${configService.get<number>('app.port') || 3000}/api/docs`);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  logger.log(`Application running on port ${port} [${nodeEnv}]`);
}

bootstrap();

// Application Insights MUST be initialized before any other imports
// so the SDK can instrument HTTP, database, and dependency calls automatically
import * as appInsights from 'applicationinsights';

// NestJS ConfigModule loads .env during app init, which is too late for App Insights.
// We load it manually here so process.env is populated before setup() is called.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

const aiConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (aiConnectionString) {
  appInsights
    .setup(aiConnectionString)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectConsole(true, true)
    .setAutoCollectPreAggregatedMetrics(true)
    .setSendLiveMetrics(false)
    .start();
}

import { AllExceptionsFilter } from '@common/filters';
import { LoggingInterceptor } from '@common/interceptors';
import { AppInsightsLogger } from '@common/logger';
import type { LogLevel } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
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

  const appLogger = new AppInsightsLogger('Bootstrap', {
    logLevels: getLogLevels(nodeEnv),
  });

  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });

  const configService = app.get(ConfigService);

  app.enableShutdownHooks();

  app.useWebSocketAdapter(new IoAdapter(app));

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
      .addTag(
        'Authentication',
        'Registro, login, OAuth, OTP y gestión de tokens',
      )
      .addTag('users', 'Gestión de usuarios y perfiles')
      .addTag('provider-profile', 'Perfil de prestador de servicios')
      .addTag('service-requests', 'Solicitudes de servicio')
      .addBearerAuth()
      .addGlobalParameters({
        name: 'X-Tenant-ID',
        in: 'header',
        required: false,
        description:
          'Tenant ID (schema). Si no se envía, se usa "public". En rutas /auth, /users y /provider-profile siempre se fuerza "public".',
        schema: { type: 'string', default: 'public' },
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Cameyo API Docs',
    });

    appLogger.log(
      `API Documentation: http://localhost:${configService.get<number>('app.port') || 3000}/api/docs`,
    );
  }

  if (aiConnectionString) {
    appLogger.log('Azure Application Insights telemetry enabled');
  } else {
    appLogger.warn(
      'APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled',
    );
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port, '0.0.0.0');

  appLogger.log(`Application running on port ${port} [${nodeEnv}]`);
}

bootstrap();
